import { getDb } from '@/lib/db'
import type { Bookmark, BookmarkCategory, BookmarkStatus } from '@/types'

// ─── Bookmark Categories ──────────────────────────────────────────────────────

export function getBookmarkCategories(): BookmarkCategory[] {
  return getDb()
    .prepare('SELECT * FROM bookmark_categories ORDER BY name')
    .all() as BookmarkCategory[]
}

export function createBookmarkCategory(name: string, color: string, createdBy: number): BookmarkCategory {
  return getDb()
    .prepare('INSERT INTO bookmark_categories (name, color, created_by) VALUES (?, ?, ?) RETURNING *')
    .get(name, color, createdBy) as BookmarkCategory
}

export function updateBookmarkCategory(id: number, name: string, color: string): BookmarkCategory | null {
  return getDb()
    .prepare('UPDATE bookmark_categories SET name = ?, color = ? WHERE id = ? RETURNING *')
    .get(name, color, id) as BookmarkCategory | null
}

export function deleteBookmarkCategory(id: number) {
  getDb().prepare('DELETE FROM bookmark_categories WHERE id = ?').run(id)
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export function getBookmarks(params: {
  category_id?: number | null
  q?: string
  favorites_only?: boolean
  status?: BookmarkStatus
  limit?: number
  cursor?: number
  userId: number
}): { items: Bookmark[]; nextCursor: number | null; total: number } {
  const db = getDb()
  const limit = Math.min(params.limit ?? 30, 100)

  let where = `b.status = 'active'`
  const args: (string | number)[] = []

  if (params.status) { where = `b.status = ?`; args.push(params.status) }
  if (params.category_id) { where += ` AND b.category_id = ?`; args.push(params.category_id) }
  if (params.q?.trim()) {
    where += ` AND (b.title LIKE ? OR b.description LIKE ?)`
    const like = `%${params.q.trim()}%`
    args.push(like, like)
  }
  if (params.favorites_only) {
    where += ` AND EXISTS (SELECT 1 FROM bookmark_favorites f WHERE f.bookmark_id = b.id AND f.user_id = ?)`
    args.push(params.userId)
  }
  if (params.cursor) {
    where += ` AND (b.created_at < (SELECT created_at FROM bookmarks WHERE id = ?) OR (b.created_at = (SELECT created_at FROM bookmarks WHERE id = ?) AND b.id < ?))`
    args.push(params.cursor, params.cursor, params.cursor)
  }

  const total = (db.prepare(`SELECT COUNT(*) as n FROM bookmarks b WHERE ${where}`).get(...args) as { n: number }).n
  const rows = db.prepare(
    `SELECT b.*, bc.name as category_name, u.name as creator_name
     FROM bookmarks b
     LEFT JOIN bookmark_categories bc ON bc.id = b.category_id
     LEFT JOIN users u ON u.id = b.created_by
     WHERE ${where}
     ORDER BY b.created_at DESC, b.id DESC
     LIMIT ?`
  ).all(...args, limit + 1) as any[]

  const hasMore = rows.length > limit
  if (hasMore) rows.pop()

  // Batch load favorites
  const ids = rows.map((r) => r.id)
  const favSet = ids.length
    ? new Set(
        (db.prepare(
          `SELECT bookmark_id FROM bookmark_favorites WHERE user_id = ? AND bookmark_id IN (${ids.map(() => '?').join(',')})`
        ).all(params.userId, ...ids) as { bookmark_id: number }[]).map((r) => r.bookmark_id)
      )
    : new Set<number>()

  const items: Bookmark[] = rows.map((r) => ({ ...r, is_favorited: favSet.has(r.id) }))

  return { items, nextCursor: hasMore ? rows[rows.length - 1].id : null, total }
}

export function getBookmarkById(id: number, userId: number): Bookmark | null {
  const db = getDb()
  const row = db.prepare(
    `SELECT b.*, bc.name as category_name, u.name as creator_name
     FROM bookmarks b
     LEFT JOIN bookmark_categories bc ON bc.id = b.category_id
     LEFT JOIN users u ON u.id = b.created_by
     WHERE b.id = ? AND b.status != 'deleted'`
  ).get(id) as any
  if (!row) return null
  db.prepare('UPDATE bookmarks SET view_count = view_count + 1 WHERE id = ?').run(id)
  const fav = db.prepare('SELECT 1 FROM bookmark_favorites WHERE user_id = ? AND bookmark_id = ?').get(userId, id)
  return { ...row, is_favorited: !!fav }
}

export function createBookmark(data: {
  title: string; url: string; description?: string
  category_id?: number | null; created_by: number
}): Bookmark {
  const db = getDb()
  const row = db.prepare(
    `INSERT INTO bookmarks (title, url, description, category_id, created_by)
     VALUES (?, ?, ?, ?, ?) RETURNING *`
  ).get(data.title, data.url, data.description ?? null, data.category_id ?? null, data.created_by) as any
  return { ...row, category_name: null, creator_name: '', is_favorited: false }
}

export function updateBookmark(id: number, data: {
  title?: string; url?: string; description?: string | null; category_id?: number | null
}): Bookmark | null {
  const db = getDb()
  const fields: string[] = []
  const vals: (string | number | null)[] = []
  if (data.title !== undefined) { fields.push('title = ?'); vals.push(data.title) }
  if (data.url !== undefined) { fields.push('url = ?'); vals.push(data.url) }
  if (data.description !== undefined) { fields.push('description = ?'); vals.push(data.description) }
  if (data.category_id !== undefined) { fields.push('category_id = ?'); vals.push(data.category_id) }
  if (!fields.length) return getBookmarkById(id, 0)
  fields.push("updated_at = datetime('now')")
  vals.push(id)
  db.prepare(`UPDATE bookmarks SET ${fields.join(', ')} WHERE id = ?`).run(...vals)
  return getBookmarkById(id, 0)
}

export function setBookmarkStatus(id: number, status: BookmarkStatus) {
  getDb().prepare(`UPDATE bookmarks SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id)
}

export function deleteBookmark(id: number) {
  getDb().prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
}

export function toggleBookmarkFavorite(userId: number, bookmarkId: number): boolean {
  const db = getDb()
  const existing = db.prepare('SELECT 1 FROM bookmark_favorites WHERE user_id = ? AND bookmark_id = ?').get(userId, bookmarkId)
  if (existing) {
    db.prepare('DELETE FROM bookmark_favorites WHERE user_id = ? AND bookmark_id = ?').run(userId, bookmarkId)
    return false
  }
  db.prepare('INSERT INTO bookmark_favorites (user_id, bookmark_id) VALUES (?, ?)').run(userId, bookmarkId)
  return true
}
