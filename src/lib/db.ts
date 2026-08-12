import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'linklib.db')

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    _db.pragma('cache_size = -8000')      // 8MB page cache
    _db.pragma('temp_store = MEMORY')     // temp tables in memory
    _db.pragma('mmap_size = 67108864')    // 64MB memory-mapped I/O
    _db.pragma('synchronous = NORMAL')    // safe with WAL, faster than FULL
    runMigrations(_db)
  }
  return _db
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      run_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = new Set(
    (db.prepare('SELECT name FROM migrations').all() as { name: string }[]).map(
      (r) => r.name
    )
  )

  for (const [name, sql] of MIGRATIONS) {
    if (!applied.has(name)) {
      db.transaction(() => {
        db.exec(sql)
        db.prepare('INSERT INTO migrations (name) VALUES (?)').run(name)
      })()
    }
  }
}

const MIGRATIONS: [string, string][] = [
  [
    '001_initial',
    `
    CREATE TABLE IF NOT EXISTS divisions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'user' CHECK(role IN ('admin','curator','user')),
      division_id   INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
      status        TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','deactivated')),
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      description TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      created_by  INTEGER NOT NULL REFERENCES users(id),
      updated_by  INTEGER REFERENCES users(id),
      status      TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','deleted')),
      view_count  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entry_links (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id        INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      url             TEXT    NOT NULL,
      label           TEXT    NOT NULL,
      source_type     TEXT    NOT NULL DEFAULT 'other' CHECK(source_type IN ('canva','gdrive','other')),
      sort_order      INTEGER NOT NULL DEFAULT 0,
      link_status     TEXT    NOT NULL DEFAULT 'unchecked' CHECK(link_status IN ('ok','broken','unchecked')),
      last_checked_at TEXT,
      visibility      TEXT    NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','protected')),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL UNIQUE COLLATE NOCASE
    );

    CREATE TABLE IF NOT EXISTS entry_tags (
      entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      tag_id   INTEGER NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
      PRIMARY KEY (entry_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
      entry_id   INTEGER NOT NULL REFERENCES entries(id)  ON DELETE CASCADE,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, entry_id)
    );

    -- FTS5 virtual table for full-text search (content stored directly)
    CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
      entry_id,
      title,
      description,
      tags,
      public_link_labels,
      all_link_labels,
      tokenize='unicode61'
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_entries_status      ON entries(status);
    CREATE INDEX IF NOT EXISTS idx_entries_category    ON entries(category_id);
    CREATE INDEX IF NOT EXISTS idx_entries_created_by  ON entries(created_by);
    CREATE INDEX IF NOT EXISTS idx_entry_links_entry   ON entry_links(entry_id);
    CREATE INDEX IF NOT EXISTS idx_entry_links_url     ON entry_links(url);
    CREATE INDEX IF NOT EXISTS idx_entry_tags_tag      ON entry_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_favorites_user      ON favorites(user_id);
    `,
  ],
  [
    '002_fix_fts',
    `
    -- Drop and recreate FTS table without content='' (contentless mode stored nulls)
    DROP TABLE IF EXISTS entries_fts;
    CREATE VIRTUAL TABLE entries_fts USING fts5(
      entry_id,
      title,
      description,
      tags,
      public_link_labels,
      all_link_labels,
      tokenize='unicode61'
    );
    `,
  ],
  [
    '003_perf_indexes',
    `
    -- Composite indexes for common sort+filter patterns
    CREATE INDEX IF NOT EXISTS idx_entries_status_created ON entries(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_entries_status_views   ON entries(status, view_count DESC);
    CREATE INDEX IF NOT EXISTS idx_entries_status_title   ON entries(status, title);
    CREATE INDEX IF NOT EXISTS idx_entry_links_entry_vis  ON entry_links(entry_id, visibility);
    `,
  ],
  [
    '004_more_source_types',
    `
    -- Expand source_type CHECK constraint to include gsheets, gdocs
    CREATE TABLE IF NOT EXISTS entry_links_new (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id        INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      url             TEXT    NOT NULL,
      label           TEXT    NOT NULL,
      source_type     TEXT    NOT NULL DEFAULT 'other' CHECK(source_type IN ('canva','gdrive','gsheets','gdocs','other')),
      sort_order      INTEGER NOT NULL DEFAULT 0,
      link_status     TEXT    NOT NULL DEFAULT 'unchecked' CHECK(link_status IN ('ok','broken','unchecked')),
      last_checked_at TEXT,
      visibility      TEXT    NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','protected')),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO entry_links_new SELECT * FROM entry_links;
    DROP TABLE entry_links;
    ALTER TABLE entry_links_new RENAME TO entry_links;
    CREATE INDEX IF NOT EXISTS idx_entry_links_entry     ON entry_links(entry_id);
    CREATE INDEX IF NOT EXISTS idx_entry_links_url       ON entry_links(url);
    CREATE INDEX IF NOT EXISTS idx_entry_links_entry_vis ON entry_links(entry_id, visibility);
    `,
  ],
  [
    '005_bookmarks',
    `
    CREATE TABLE IF NOT EXISTS bookmark_categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      color      TEXT    NOT NULL DEFAULT '#6366f1',
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      url         TEXT    NOT NULL,
      description TEXT,
      category_id INTEGER REFERENCES bookmark_categories(id) ON DELETE SET NULL,
      created_by  INTEGER NOT NULL REFERENCES users(id),
      status      TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
      view_count  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookmark_favorites (
      user_id     INTEGER NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
      bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, bookmark_id)
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_status     ON bookmarks(status);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_category   ON bookmarks(category_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_created_by ON bookmarks(created_by);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bm_favorites_user    ON bookmark_favorites(user_id);
    `,
  ],
  [
    '006_notes',
    `
    CREATE TABLE IF NOT EXISTS notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT    NOT NULL DEFAULT 'Untitled',
      body       TEXT    NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id),
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS note_images (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id    INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      filename   TEXT    NOT NULL,
      original   TEXT    NOT NULL,
      size       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notes_created_by ON notes(created_by);
    CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_note_images_note ON note_images(note_id);
    `,
  ],
  [
    '007_reminders',
    `
    CREATE TABLE IF NOT EXISTS reminders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      type         TEXT    NOT NULL DEFAULT 'other' CHECK(type IN ('domain','hosting','ssl','subscription','other')),
      expires_at   TEXT    NOT NULL,
      notes        TEXT,
      status       TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','done')),
      created_by   INTEGER NOT NULL REFERENCES users(id),
      updated_by   INTEGER REFERENCES users(id),
      done_at      TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reminders_status     ON reminders(status);
    CREATE INDEX IF NOT EXISTS idx_reminders_expires_at ON reminders(expires_at);
    `,
  ],
  [
    '008_reminder_recurrence',
    `
    ALTER TABLE reminders ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none'
      CHECK(recurrence IN ('none','monthly','yearly'));
    `,
  ],
]

/** Rebuild the FTS index for a single entry (call after insert/update) */
export function indexEntry(db: Database.Database, entryId: number) {
  const entry = db
    .prepare('SELECT id, title, description FROM entries WHERE id = ?')
    .get(entryId) as { id: number; title: string; description: string | null } | undefined

  if (!entry) return

  const tags = (
    db
      .prepare(
        `SELECT t.name FROM tags t
         JOIN entry_tags et ON et.tag_id = t.id
         WHERE et.entry_id = ?`
      )
      .all(entryId) as { name: string }[]
  )
    .map((r) => r.name)
    .join(' ')

  const links = db
    .prepare('SELECT label, visibility FROM entry_links WHERE entry_id = ?')
    .all(entryId) as { label: string; visibility: string }[]

  const publicLabels = links
    .filter((l) => l.visibility === 'public')
    .map((l) => l.label)
    .join(' ')

  const allLabels = links.map((l) => l.label).join(' ')

  db.prepare("DELETE FROM entries_fts WHERE entry_id = ?").run(entryId)
  db.prepare(
    `INSERT INTO entries_fts (entry_id, title, description, tags, public_link_labels, all_link_labels)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(entryId, entry.title, entry.description ?? '', tags, publicLabels, allLabels)
}

/** Remove entry from FTS index */
export function deindexEntry(db: Database.Database, entryId: number) {
  db.prepare("DELETE FROM entries_fts WHERE entry_id = ?").run(entryId)
}
