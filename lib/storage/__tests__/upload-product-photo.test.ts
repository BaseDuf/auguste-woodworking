import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpload = vi.hoisted(() => vi.fn())
const mockGetPublicUrl = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }),
    },
  }),
}))

import { uploadProductPhoto } from '../upload-product-photo'

const makeFile = (type: string, size: number) =>
  new File(['x'.repeat(size)], 'img.jpg', { type })

describe('uploadProductPhoto', () => {
  beforeEach(() => {
    mockUpload.mockReset()
    mockGetPublicUrl.mockReset()
    mockUpload.mockResolvedValue({ data: {}, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/p1/uuid.jpg' } })
  })

  it('throws when MIME type is not allowed', async () => {
    await expect(uploadProductPhoto('p1', makeFile('image/gif', 100))).rejects.toThrow(
      'Format non supporté (JPEG, PNG, WebP, AVIF)'
    )
  })

  it('throws when file size is 0', async () => {
    // Review Focus #2
    await expect(uploadProductPhoto('p1', makeFile('image/jpeg', 0))).rejects.toThrow('Fichier vide')
  })

  it('throws when file size exceeds 10 MB', async () => {
    await expect(uploadProductPhoto('p1', makeFile('image/jpeg', 11 * 1024 * 1024))).rejects.toThrow(
      'Fichier trop volumineux (10 Mo max)'
    )
  })

  it('throws when storage upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: new Error('storage fail') })
    await expect(uploadProductPhoto('p1', makeFile('image/jpeg', 500))).rejects.toThrow(
      "Erreur lors de l'upload"
    )
  })

  it('returns path and url on successful upload', async () => {
    const result = await uploadProductPhoto('p1', makeFile('image/jpeg', 500))
    expect(result.url).toBe('https://cdn.example.com/p1/uuid.jpg')
    expect(result.path).toMatch(/^p1\/[0-9a-f-]+\.jpg$/)
  })
})
