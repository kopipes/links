import { apiError, apiResponse, requireUser, ApiError } from '@/lib/api'
import { addNoteImage } from '@/lib/note-queries'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads')
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png']

export async function POST(request: Request, ctx: RouteContext<'/api/notes/[id]/images'>) {
  try {
    const user = requireUser(request)
    const { id } = await ctx.params
    const noteId = Number(id)

    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) return apiError(400, 'image file is required')
    if (!ALLOWED_TYPES.includes(file.type)) return apiError(400, 'Only JPG and PNG images are allowed')
    if (file.size > MAX_SIZE) return apiError(400, 'Image must be under 5MB')

    // Ensure uploads directory exists
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

    // Generate unique filename
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`
    const filepath = path.join(UPLOADS_DIR, filename)

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filepath, buffer)

    const image = addNoteImage(noteId, filename, file.name, file.size)
    return apiResponse(image, 201)
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    console.error('[upload image]', err)
    return apiError(500, 'Internal server error')
  }
}
