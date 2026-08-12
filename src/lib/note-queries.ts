import { getDb } from '@/lib/db'

export interface Note {
  id: number
  title: string
  body: string
  created_by: number
  creator_name: string
  updated_by: number | null
  created_at: string
  updated_at: string
  images: NoteImage[]
}

export interface NoteImage {
  id: number
  note_id: number
  filename: string
  original: string
  size: number
  created_at: string
}

export function getNotes(userId: number, q?: string): Note[] {
  const db = getDb()
  let where = '1=1'
  const args: (string | number)[] = []

  if (q?.trim()) {
    where += ` AND (n.title LIKE ? OR n.body LIKE ?)`
    const like = `%${q.trim()}%`
    args.push(like, like)
  }

  const rows = db.prepare(
    `SELECT n.*, u.name as creator_name
     FROM notes n
     LEFT JOIN users u ON u.id = n.created_by
     WHERE ${where}
     ORDER BY n.updated_at DESC, n.id DESC`
  ).all(...args) as any[]

  const noteIds = rows.map(r => r.id)
  if (!noteIds.length) return []

  const images = noteIds.length
    ? db.prepare(
        `SELECT * FROM note_images WHERE note_id IN (${noteIds.map(() => '?').join(',')}) ORDER BY note_id, created_at`
      ).all(...noteIds) as NoteImage[]
    : []

  const imgMap = new Map<number, NoteImage[]>()
  for (const img of images) {
    if (!imgMap.has(img.note_id)) imgMap.set(img.note_id, [])
    imgMap.get(img.note_id)!.push(img)
  }

  return rows.map(r => ({ ...r, images: imgMap.get(r.id) ?? [] }))
}

export function getNoteById(id: number): Note | null {
  const db = getDb()
  const row = db.prepare(
    `SELECT n.*, u.name as creator_name FROM notes n LEFT JOIN users u ON u.id = n.created_by WHERE n.id = ?`
  ).get(id) as any
  if (!row) return null

  const images = db.prepare('SELECT * FROM note_images WHERE note_id = ? ORDER BY created_at').all(id) as NoteImage[]
  return { ...row, images }
}

export function createNote(data: { title: string; body: string; created_by: number }): Note {
  const db = getDb()
  const row = db.prepare(
    `INSERT INTO notes (title, body, created_by, updated_by) VALUES (?, ?, ?, ?) RETURNING *`
  ).get(data.title, data.body, data.created_by, data.created_by) as any
  return { ...row, creator_name: '', images: [] }
}

export function updateNote(id: number, data: { title?: string; body?: string; updated_by: number }): Note | null {
  const db = getDb()
  const fields: string[] = ["updated_at = datetime('now')", 'updated_by = ?']
  const vals: (string | number)[] = [data.updated_by]

  if (data.title !== undefined) { fields.push('title = ?'); vals.push(data.title) }
  if (data.body !== undefined) { fields.push('body = ?'); vals.push(data.body) }

  vals.push(id)
  db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...vals)
  return getNoteById(id)
}

export function deleteNote(id: number) {
  // Images are deleted via ON DELETE CASCADE
  getDb().prepare('DELETE FROM notes WHERE id = ?').run(id)
}

export function addNoteImage(noteId: number, filename: string, original: string, size: number): NoteImage {
  return getDb().prepare(
    `INSERT INTO note_images (note_id, filename, original, size) VALUES (?, ?, ?, ?) RETURNING *`
  ).get(noteId, filename, original, size) as NoteImage
}

export function deleteNoteImage(id: number): string | null {
  const db = getDb()
  const img = db.prepare('SELECT filename FROM note_images WHERE id = ?').get(id) as { filename: string } | undefined
  if (!img) return null
  db.prepare('DELETE FROM note_images WHERE id = ?').run(id)
  return img.filename
}
