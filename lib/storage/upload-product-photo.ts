import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024
const BUCKET = 'product-photos'

export async function uploadProductPhoto(
  productId: string,
  file: File
): Promise<{ path: string; url: string }> {
  if (file.size === 0) {
    throw new Error('File is empty')
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('File too large')
  }
  const extension = ALLOWED_MIME[file.type]
  if (!extension) {
    throw new Error('Unsupported file type')
  }

  const path = `${productId}/${crypto.randomUUID()}.${extension}`
  const storage = createAdminClient().storage.from(BUCKET)

  const { error } = await storage.upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) {
    throw error
  }

  const { data } = storage.getPublicUrl(path)
  return { path, url: data.publicUrl }
}
