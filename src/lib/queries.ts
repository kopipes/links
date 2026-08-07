import { getDb, indexEntry, deindexEntry } from '@/lib/db'
import type {
  Entry,
  EntryWithDetails,
  EntryLink,
  Tag,
  Category,
  Division,
  User,
  UserWithDivision,
  SearchParams,
  PaginatedResult,
  Role,
} from '@/types'
import type Database from 'better-sqlite3'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Batch-load tags for a set of entry IDs — single query instead of N queries */
function batchLoadTags(db: Database.Database, entryIds: number[]): Map<number, Tag[]> {
  if (!entryIds.length) return new Map()
  const placeholders = entryIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT et.entry_id, t.id, t.name
       FROM entry_tags et JOIN tags t ON t.id = et.tag_id
       WHERE et.entry_id IN (${placeholders})
       ORDER BY et.entry_id, t.name`
    )
    .all(...entryIds) as { entry_id: number; id: number; name: string }[]

  const map = new Map<number, Tag[]>()
  for (const row of rows) {
    if (!map.has(row.entry_id)) map.set(row.entry_id, [])
    map.get(row.entry_id)!.push({ id: row.id, name: row.name })
  }
  return map
}

/** Batch-load links for a set of entry IDs — single query instead of N queries */
function batchLoadLinks(
  db: Database.Database,
  entryIds: number[],
  isPrivileged: boolean
): Map<number, EntryLink[]> {
  if (!entryIds.length) return new Map()
  const placeholders = entryIds.map(() => '?').join(',')
  const visFilter = isPrivileged ? '' : `AND visibility = 'public'`
  const rows = db
    .prepare(
      `SELECT * FROM entry_links
       WHERE entry_id IN (${placeholders}) ${visFilter}
       ORDER BY entry_id, sort_order, id`
    )
    .all(...entryIds) as EntryLink[]

  const map = new Map<number, EntryLink[]>()
  for (const row of rows) {
    if (!map.has(row.entry_id)) map.set(row.entry_id, [])
    map.get(row.entry_id)!.push(row)
  }
  return map
}

/** Batch-load favorites for a set of entry IDs — single query */
function batchLoadFavorites(
  db: Database.Database,
  entryIds: number[],
  userId: number
): Set<number> {
  if (!entryIds.length) return new Set()
  const placeholders = entryIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT entry_id FROM favorites
       WHERE user_id = ? AND entry_id IN (${placeholders})`
    )
    .all(userId, ...entryIds) as { entry_id: number }[]
  return new Set(rows.map((r) => r.entry_id))
}

function hydrateEntry(
  row: Entry & { category_name?: string | null; creator_name?: string },
  tags: Tag[],
  links: EntryLink[],
  is_favorited: boolean
): EntryWithDetails {
  return {
    ...row,
    category_name: row.category_name ?? null,
    creator_name: row.creator_name ?? '',
    tags,
    links,
    is_favorited,
  }
}

// ─── Entries ─────────────────────────────────────────────────────────────────

export function getEntries(
  params: SearchParams,
  userId: number | null,
  isPrivileged: boolean
): PaginatedResult<EntryWithDetails> {
  const db = getDb()
  const limit = Math.min(params.limit ?? 20, 100)

  let baseWhere = isPrivileged
    ? `e.status != 'deleted'`
    : `e.status = 'active' AND EXISTS (
        SELECT 1 FROM entry_links el
        WHERE el.entry_id = e.id AND el.visibility = 'public'
       )`

  const args: (string | number)[] = []

  if (params.category_id) {
    baseWhere += ` AND e.category_id = ?`
    args.push(params.category_id)
  }

  if (params.status && isPrivileged) {
    baseWhere = `e.status = ?`
    args.unshift(params.status)
  }

  if (params.tag) {
    baseWhere += ` AND EXISTS (
      SELECT 1 FROM entry_tags et JOIN tags t ON t.id = et.tag_id
      WHERE et.entry_id = e.id AND t.name = ? COLLATE NOCASE
    )`
    args.push(params.tag)
  }

  if (params.favorites_only && userId) {
    baseWhere += ` AND EXISTS (
      SELECT 1 FROM favorites f WHERE f.entry_id = e.id AND f.user_id = ?
    )`
    args.push(userId)
  }

  // Full-text search
  if (params.q && params.q.trim()) {
    const term = params.q.trim().replace(/["'*]/g, '').trim()
    if (term) {
      const ftsCol = isPrivileged ? 'all_link_labels' : 'public_link_labels'
      // Use column filter with prefix wildcard - no quotes so * works
      const ftsQuery = `{title description tags ${ftsCol}} : ${term}*`

      let ftsIds: { entry_id: number }[] = []
      try {
        ftsIds = db
          .prepare(`SELECT entry_id FROM entries_fts WHERE entries_fts MATCH ? ORDER BY rank`)
          .all(ftsQuery) as { entry_id: number }[]
      } catch {
        // Fallback: plain prefix match
        try {
          ftsIds = db
            .prepare(`SELECT entry_id FROM entries_fts WHERE entries_fts MATCH ? ORDER BY rank`)
            .all(`${term}*`) as { entry_id: number }[]
        } catch {
          ftsIds = []
        }
      }

      if (!ftsIds.length) return { items: [], nextCursor: null, total: 0 }

      const idList = ftsIds.map((r) => r.entry_id).join(',')
      baseWhere += ` AND e.id IN (${idList})`
    }
  }

  // Cursor pagination
  if (params.cursor) {
    const cursorEntry = db
      .prepare('SELECT created_at, view_count, title FROM entries WHERE id = ?')
      .get(params.cursor) as { created_at: string; view_count: number; title: string } | undefined

    if (cursorEntry) {
      if (params.sort === 'popular') {
        baseWhere += ` AND (e.view_count < ? OR (e.view_count = ? AND e.id < ?))`
        args.push(cursorEntry.view_count, cursorEntry.view_count, params.cursor)
      } else if (params.sort === 'title') {
        baseWhere += ` AND (e.title > ? OR (e.title = ? AND e.id > ?))`
        args.push(cursorEntry.title, cursorEntry.title, params.cursor)
      } else {
        baseWhere += ` AND (e.created_at < ? OR (e.created_at = ? AND e.id < ?))`
        args.push(cursorEntry.created_at, cursorEntry.created_at, params.cursor)
      }
    }
  }

  const orderBy =
    params.sort === 'popular'
      ? 'e.view_count DESC, e.id DESC'
      : params.sort === 'title'
      ? 'e.title ASC, e.id ASC'
      : 'e.created_at DESC, e.id DESC'

  const totalRow = db
    .prepare(
      `SELECT COUNT(*) as n FROM entries e WHERE ${baseWhere}`
    )
    .get(...args) as { n: number }

  const rows = db
    .prepare(
      `SELECT e.*, c.name as category_name, u.name as creator_name
       FROM entries e
       LEFT JOIN categories c ON c.id = e.category_id
       LEFT JOIN users u ON u.id = e.created_by
       WHERE ${baseWhere}
       ORDER BY ${orderBy}
       LIMIT ?`
    )
    .all(...args, limit + 1) as (Entry & { category_name: string | null; creator_name: string })[]

  const hasMore = rows.length > limit
  if (hasMore) rows.pop()

  // Batch load tags, links, favorites — 3 queries total regardless of page size
  const entryIds = rows.map((r) => r.id)
  const tagsMap = batchLoadTags(db, entryIds)
  const linksMap = batchLoadLinks(db, entryIds, isPrivileged)
  const favSet = userId ? batchLoadFavorites(db, entryIds, userId) : new Set<number>()

  const items = rows.map((r) =>
    hydrateEntry(r, tagsMap.get(r.id) ?? [], linksMap.get(r.id) ?? [], favSet.has(r.id))
  )

  return {
    items,
    nextCursor: hasMore ? rows[rows.length - 1].id : null,
    total: totalRow.n,
  }
}

export function getEntryById(
  id: number,
  userId: number | null,
  isPrivileged: boolean
): EntryWithDetails | null {
  const db = getDb()

  const row = db
    .prepare(
      `SELECT e.*, c.name as category_name, u.name as creator_name
       FROM entries e
       LEFT JOIN categories c ON c.id = e.category_id
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.id = ? AND e.status != 'deleted'`
    )
    .get(id) as (Entry & { category_name: string | null; creator_name: string }) | undefined

  if (!row) return null

  // Non-privileged users can't see entries with all-protected links
  if (!isPrivileged) {
    const pubLinks = db
      .prepare(`SELECT COUNT(*) as n FROM entry_links WHERE entry_id = ? AND visibility = 'public'`)
      .get(id) as { n: number }
    if (pubLinks.n === 0) return null
  }

  // Increment view count
  db.prepare('UPDATE entries SET view_count = view_count + 1 WHERE id = ?').run(id)

  const tagsMap = batchLoadTags(db, [id])
  const linksMap = batchLoadLinks(db, [id], isPrivileged)
  const favSet = userId ? batchLoadFavorites(db, [id], userId) : new Set<number>()

  return hydrateEntry(row, tagsMap.get(id) ?? [], linksMap.get(id) ?? [], favSet.has(id))
}

export function createEntry(
  data: {
    title: string
    description?: string
    category_id?: number | null
    created_by: number
    links: { url: string; label: string; source_type: string; visibility: string }[]
    tags: string[]
  },
  isPrivileged: boolean
): EntryWithDetails {
  const db = getDb()

  const result = db.transaction(() => {
    const entry = db
      .prepare(
        `INSERT INTO entries (title, description, category_id, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?)
         RETURNING *`
      )
      .get(
        data.title,
        data.description ?? null,
        data.category_id ?? null,
        data.created_by,
        data.created_by
      ) as Entry

    for (let i = 0; i < data.links.length; i++) {
      const link = data.links[i]
      const visibility = isPrivileged ? link.visibility : 'public'
      db.prepare(
        `INSERT INTO entry_links (entry_id, url, label, source_type, sort_order, visibility)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(entry.id, link.url, link.label, link.source_type, i, visibility)
    }

    const tagIds = resolveOrCreateTags(db, data.tags)
    for (const tagId of tagIds) {
      db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)').run(
        entry.id,
        tagId
      )
    }

    indexEntry(db, entry.id)
    return entry.id
  })()

  return getEntryById(result, data.created_by, isPrivileged)!
}

export function updateEntry(
  id: number,
  data: {
    title?: string
    description?: string | null
    category_id?: number | null
    links?: { id?: number; url: string; label: string; source_type: string; sort_order?: number; visibility: string }[]
    tags?: string[]
    updated_by: number
  },
  isPrivileged: boolean
): EntryWithDetails | null {
  const db = getDb()

  db.transaction(() => {
    if (data.title !== undefined || data.description !== undefined || data.category_id !== undefined) {
      db.prepare(
        `UPDATE entries
         SET title = COALESCE(?, title),
             description = CASE WHEN ? IS NOT NULL THEN ? ELSE description END,
             category_id = CASE WHEN ? IS NOT NULL THEN ? ELSE category_id END,
             updated_by = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        data.title ?? null,
        data.description !== undefined ? 1 : null,
        data.description ?? null,
        data.category_id !== undefined ? 1 : null,
        data.category_id ?? null,
        data.updated_by,
        id
      )
    }

    if (data.links !== undefined) {
      const incomingIds = data.links.filter((l) => l.id).map((l) => l.id!)
      if (incomingIds.length) {
        db.prepare(
          `DELETE FROM entry_links WHERE entry_id = ? AND id NOT IN (${incomingIds.join(',')})`
        ).run(id)
      } else {
        db.prepare('DELETE FROM entry_links WHERE entry_id = ?').run(id)
      }

      for (let i = 0; i < data.links.length; i++) {
        const link = data.links[i]
        const visibility = isPrivileged ? link.visibility : 'public'
        if (link.id) {
          db.prepare(
            `UPDATE entry_links SET url=?, label=?, source_type=?, sort_order=?, visibility=?
             WHERE id=? AND entry_id=?`
          ).run(link.url, link.label, link.source_type, link.sort_order ?? i, visibility, link.id, id)
        } else {
          db.prepare(
            `INSERT INTO entry_links (entry_id, url, label, source_type, sort_order, visibility)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).run(id, link.url, link.label, link.source_type, link.sort_order ?? i, visibility)
        }
      }
    }

    if (data.tags !== undefined) {
      db.prepare('DELETE FROM entry_tags WHERE entry_id = ?').run(id)
      const tagIds = resolveOrCreateTags(db, data.tags)
      for (const tagId of tagIds) {
        db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)').run(id, tagId)
      }
    }

    indexEntry(db, id)
  })()

  return getEntryById(id, data.updated_by, isPrivileged)
}

export function setEntryStatus(
  id: number,
  status: 'active' | 'archived' | 'deleted',
  updatedBy: number
) {
  const db = getDb()
  db.prepare(
    `UPDATE entries SET status = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, updatedBy, id)
  if (status === 'deleted') deindexEntry(db, id)
  else indexEntry(db, id)
}

export function hardDeleteEntry(id: number) {
  const db = getDb()
  deindexEntry(db, id)
  db.prepare('DELETE FROM entries WHERE id = ?').run(id)
}

export function checkDuplicateUrl(url: string): EntryWithDetails | null {
  const db = getDb()
  const link = db
    .prepare(
      `SELECT entry_id FROM entry_links el
       JOIN entries e ON e.id = el.entry_id
       WHERE el.url = ? AND e.status != 'deleted'
       LIMIT 1`
    )
    .get(url) as { entry_id: number } | undefined
  if (!link) return null
  return getEntryById(link.entry_id, null, true)
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

function resolveOrCreateTags(db: Database.Database, names: string[]): number[] {
  return names
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)
    .map((name) => {
      const existing = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(name) as { id: number } | undefined
      if (existing) return existing.id
      const inserted = db.prepare('INSERT INTO tags (name) VALUES (?) RETURNING id').get(name) as { id: number }
      return inserted.id
    })
}

export function getAllTags(): Tag[] {
  return getDb().prepare('SELECT * FROM tags ORDER BY name').all() as Tag[]
}

export function searchTags(q: string): Tag[] {
  return getDb()
    .prepare('SELECT * FROM tags WHERE name LIKE ? ORDER BY name LIMIT 20')
    .all(`${q}%`) as Tag[]
}

// ─── Categories ───────────────────────────────────────────────────────────────

export function getAllCategories(): Category[] {
  return getDb().prepare('SELECT * FROM categories ORDER BY name').all() as Category[]
}

export function createCategory(name: string): Category {
  return getDb()
    .prepare('INSERT INTO categories (name) VALUES (?) RETURNING *')
    .get(name) as Category
}

export function updateCategory(id: number, name: string): Category | null {
  return getDb()
    .prepare('UPDATE categories SET name = ? WHERE id = ? RETURNING *')
    .get(name, id) as Category | null
}

export function deleteCategory(id: number) {
  getDb().prepare('DELETE FROM categories WHERE id = ?').run(id)
}

// ─── Favorites ────────────────────────────────────────────────────────────────

export function toggleFavorite(userId: number, entryId: number): boolean {
  const db = getDb()
  const existing = db
    .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND entry_id = ?')
    .get(userId, entryId)
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND entry_id = ?').run(userId, entryId)
    return false
  }
  db.prepare('INSERT INTO favorites (user_id, entry_id) VALUES (?, ?)').run(userId, entryId)
  return true
}

// ─── Divisions ────────────────────────────────────────────────────────────────

export function getAllDivisions(): Division[] {
  return getDb().prepare('SELECT * FROM divisions ORDER BY name').all() as Division[]
}

export function createDivision(name: string, description?: string): Division {
  return getDb()
    .prepare('INSERT INTO divisions (name, description) VALUES (?, ?) RETURNING *')
    .get(name, description ?? null) as Division
}

export function updateDivision(id: number, name: string, description?: string): Division | null {
  return getDb()
    .prepare('UPDATE divisions SET name = ?, description = ? WHERE id = ? RETURNING *')
    .get(name, description ?? null, id) as Division | null
}

export function deleteDivision(id: number) {
  getDb().prepare('DELETE FROM divisions WHERE id = ?').run(id)
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function getUserByEmail(email: string) {
  return getDb()
    .prepare(
      `SELECT u.*, d.name as division_name FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       WHERE u.email = ?`
    )
    .get(email) as (UserWithDivision & { password_hash: string }) | undefined
}

export function getUserById(id: number) {
  return getDb()
    .prepare(
      `SELECT u.*, d.name as division_name FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       WHERE u.id = ?`
    )
    .get(id) as UserWithDivision | undefined
}

export function createUser(data: {
  name: string
  email: string
  password_hash: string
  role?: Role
  division_id?: number | null
}): User {
  return getDb()
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, division_id)
       VALUES (?, ?, ?, ?, ?) RETURNING id, name, email, role, division_id, status, created_at`
    )
    .get(
      data.name,
      data.email,
      data.password_hash,
      data.role ?? 'user',
      data.division_id ?? null
    ) as User
}

export function updateUser(
  id: number,
  data: {
    name?: string
    email?: string
    password_hash?: string
    role?: Role
    division_id?: number | null
    status?: 'active' | 'deactivated'
  }
): UserWithDivision | null {
  const db = getDb()
  const fields: string[] = []
  const vals: (string | number | null)[] = []

  if (data.name !== undefined) { fields.push('name = ?'); vals.push(data.name) }
  if (data.email !== undefined) { fields.push('email = ?'); vals.push(data.email) }
  if (data.password_hash !== undefined) { fields.push('password_hash = ?'); vals.push(data.password_hash) }
  if (data.role !== undefined) { fields.push('role = ?'); vals.push(data.role) }
  if (data.division_id !== undefined) { fields.push('division_id = ?'); vals.push(data.division_id) }
  if (data.status !== undefined) { fields.push('status = ?'); vals.push(data.status) }

  if (!fields.length) return getUserById(id) ?? null

  vals.push(id)
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...vals)
  return getUserById(id) ?? null
}

export function listUsers(params: { division_id?: number; status?: string; role?: Role } = {}): UserWithDivision[] {
  const db = getDb()
  const conditions: string[] = []
  const args: (string | number)[] = []

  if (params.division_id) { conditions.push('u.division_id = ?'); args.push(params.division_id) }
  if (params.status) { conditions.push('u.status = ?'); args.push(params.status) }
  if (params.role) { conditions.push('u.role = ?'); args.push(params.role) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.division_id, u.status, u.created_at, d.name as division_name
       FROM users u LEFT JOIN divisions d ON d.id = u.division_id
       ${where} ORDER BY u.name`
    )
    .all(...args) as UserWithDivision[]
}

export function countUsers(): number {
  return (getDb().prepare('SELECT COUNT(*) as n FROM users WHERE status = ?').get('active') as { n: number }).n
}

// ─── Admin dashboard ──────────────────────────────────────────────────────────

export function getBrokenLinks() {
  return getDb()
    .prepare(
      `SELECT el.*, e.title as entry_title, e.id as entry_id, u.name as creator_name
       FROM entry_links el
       JOIN entries e ON e.id = el.entry_id
       JOIN users u ON u.id = e.created_by
       WHERE el.link_status = 'broken' AND e.status = 'active'
       ORDER BY el.last_checked_at DESC`
    )
    .all()
}

export function getAdminStats() {
  const db = getDb()
  // Single query for all stats instead of 5 separate queries
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'active'   THEN 1 ELSE 0 END) as totalEntries,
      SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archivedEntries
    FROM entries
  `).get() as { totalEntries: number; archivedEntries: number }

  const linkRow = db.prepare(`
    SELECT
      SUM(CASE WHEN link_status = 'broken'    THEN 1 ELSE 0 END) as brokenLinks,
      SUM(CASE WHEN link_status = 'unchecked' THEN 1 ELSE 0 END) as uncheckedLinks
    FROM entry_links
  `).get() as { brokenLinks: number; uncheckedLinks: number }

  const totalUsers = (db.prepare(`SELECT COUNT(*) as n FROM users WHERE status = 'active'`).get() as { n: number }).n

  return {
    totalEntries: row.totalEntries ?? 0,
    archivedEntries: row.archivedEntries ?? 0,
    totalUsers,
    brokenLinks: linkRow.brokenLinks ?? 0,
    uncheckedLinks: linkRow.uncheckedLinks ?? 0,
  }
}

export function updateLinkStatus(linkId: number, status: 'ok' | 'broken' | 'unchecked') {
  getDb()
    .prepare(
      `UPDATE entry_links SET link_status = ?, last_checked_at = datetime('now') WHERE id = ?`
    )
    .run(status, linkId)
}
