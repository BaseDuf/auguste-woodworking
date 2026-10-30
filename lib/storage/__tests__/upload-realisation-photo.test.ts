import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpload = vi.hoisted(() => vi.fn())
const mockGetPublicUrl = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }) },
  }),
}))

import { uploadRealisationPhoto } from '../upload-realisation-photo'

const makeFile = (type: string, size: number) =>
  new File(['x'.repeat(size)], 'img.jpg', { type })

describe('uploadRealisationPhoto', () => {
  beforeEach(() => {
    mockUpload.mockReset()
    mockGetPublicUrl.mockReset()
    mockUpload.mockResolvedValue({ data: {}, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/r1/uuid.jpg' } })
  })

  it('throws when MIME type is not allowed', async () => {
    await expect(uploadRealisationPhoto('r1', makeFile('image/gif', 100))).rejects.toThrow(
      'Format non supporté (JPEG, PNG, WebP, AVIF)'
    )
  })

  it('throws when file is empty', async () => {
    await expect(uploadRealisationPhoto('r1', makeFile('image/jpeg', 0))).rejects.toThrow(
      'Fichier vide'
    )
  })

  it('throws when file exceeds 10 MB', async () => {
    await expect(
      uploadRealisationPhoto('r1', makeFile('image/jpeg', 11 * 1024 * 1024))
    ).rejects.toThrow('Fichier trop volumineux (10 Mo max)')
  })

  it('throws when storage upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: new Error('storage fail') })
    await expect(uploadRealisationPhoto('r1', makeFile('image/jpeg', 500))).rejects.toThrow(
      "Erreur lors de l'upload"
    )
  })

  it('returns path and url on success', async () => {
    const result = await uploadRealisationPhoto('r1', makeFile('image/jpeg', 500))
    expect(result.url).toBe('https://cdn.example.com/r1/uuid.jpg')
    expect(result.path).toMatch(/^r1\/[0-9a-f-]+\.jpg$/)
  })
})
