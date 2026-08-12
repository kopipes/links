import { apiError, getUser } from '@/lib/api'
import fs from 'fs'
import path from 'path'

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads')

export async function GET(request: Request, ctx: RouteContext<'/api/notes/image/[filename]'>) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')

  const { filename } = await ctx.params

  // Sanitize filename — no path traversal
  const safe = path.basename(filename)
  if (!safe || safe !== filename) return apiError(400, 'Invalid filename')

  const filepath = path.join(UPLOADS_DIR, safe)
  if (!fs.existsSync(filepath)) return apiError(404, 'Image not found')

  const ext = path.extname(safe).toLowerCase()
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg'

  const buffer = fs.readFileSync(filepath)
  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=31536000',
    },
  })
}
