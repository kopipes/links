import { apiError, apiResponse, requireUser, ApiError } from '@/lib/api'
import { deleteNoteImage } from '@/lib/note-queries'
import fs from 'fs'
import path from 'path'

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads')

export async function DELETE(request: Request, ctx: RouteContext<'/api/notes/[id]/images/[imgId]'>) {
  try {
    const user = requireUser(request)
    const { imgId } = await ctx.params
    const filename = deleteNoteImage(Number(imgId))
    if (!filename) return apiError(404, 'Image not found')

    // Delete file from disk
    const filepath = path.join(UPLOADS_DIR, filename)
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath)

    return apiResponse({ ok: true })
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    return apiError(500, 'Internal server error')
  }
}
