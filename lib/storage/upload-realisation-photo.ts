import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024
const BUCKET = 'realisation-photos'

export async function uploadRealisationPhoto(
  realisationId: string,
  file: File
): Promise<{ path: string; url: string }> {
  if (file.size === 0) {
    throw new Error('Fichier vide')
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Fichier trop volumineux (10 Mo max)')
  }
  const extension = ALLOWED_MIME[file.type]
  if (!extension) {
    throw new Error('Format non supporté (JPEG, PNG, WebP, AVIF)')
  }

  const path = `${realisationId}/${crypto.randomUUID()}.${extension}`
  const storage = createAdminClient().storage.from(BUCKET)

  const { error } = await storage.upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) {
    throw new Error("Erreur lors de l'upload")
  }

  const { data } = storage.getPublicUrl(path)
  return { path, url: data.publicUrl }
}
