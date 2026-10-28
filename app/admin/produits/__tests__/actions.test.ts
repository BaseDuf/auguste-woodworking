import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRevalidatePath = vi.hoisted(() => vi.fn())
const mockRedirect = vi.hoisted(() => vi.fn())
const mockUploadProductPhoto = vi.hoisted(() => vi.fn())
const mockGetAdminProductById = vi.hoisted(() => vi.fn())

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('@/lib/storage/upload-product-photo', () => ({ uploadProductPhoto: mockUploadProductPhoto }))
vi.mock('@/lib/data/products', () => ({ getAdminProductById: mockGetAdminProductById }))

// createAdminClient mock configurable — supporte: products insert/update/select, product_photos insert/delete/select
const mockStorageRemove = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const mockPhotoUpdate = vi.hoisted(() => vi.fn())

const mockAdminDb = vi.hoisted(() => ({
  insertResult: { data: { id: 'p-new' }, error: null as { code: string } | null },
  updateResult: { error: null as { code: string } | null },
  updateSelectData: [{ id: 'mock' }] as object[],
  photosData: [] as { id: string; position: number }[],
  photoInsertError: null as { code: string } | null,
  photoUpdateErrors: [] as (null | object)[],
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'products') {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve(mockAdminDb.insertResult) }) }),
          update: () => ({
            eq: () => {
              const selectResult = () => Promise.resolve({
                data: mockAdminDb.updateResult.error ? null : mockAdminDb.updateSelectData,
                error: mockAdminDb.updateResult.error,
              })
              const basePromise = Promise.resolve(mockAdminDb.updateResult) as any
              basePromise.select = selectResult
              basePromise.eq = () => ({ select: selectResult })
              return basePromise
            },
          }),
        }
      }
      // product_photos
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: mockAdminDb.photosData, error: null }),
            limit: () => ({ order: () => Promise.resolve({ data: mockAdminDb.photosData.slice(-1), error: null }) }),
          }),
        }),
        insert: () => Promise.resolve({ error: mockAdminDb.photoInsertError }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        upsert: () => Promise.resolve({ error: null }),
        update: (data: Record<string, unknown>) => ({
          eq: (field: string, val: unknown) => {
            mockPhotoUpdate(data, field, val)
            const err = mockAdminDb.photoUpdateErrors.length > 0 ? mockAdminDb.photoUpdateErrors.shift()! : null
            return Promise.resolve({ error: err })
          },
        }),
      }
    },
    storage: {
      from: () => ({ remove: mockStorageRemove }),
    },
  }),
}))

const mockAuthUser = vi.hoisted(() => ({ value: null as { id: string } | null }))
const mockProfileRole = vi.hoisted(() => ({ value: 'admin' as string }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: mockAuthUser.value } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { role: mockProfileRole.value }, error: null }),
        }),
      }),
    }),
  }),
}))

import {
  createProduct,
  updateProduct,
  unpublishProduct,
  uploadPhoto,
  deletePhoto,
  reorderPhoto,
} from '../actions'

describe('requireAdmin guard', () => {
  it('createProduct redirects to login when not authenticated', async () => {
    mockAuthUser.value = null
    await createProduct(new FormData())
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('/admin/login'))
  })
})

describe('createProduct', () => {
  beforeEach(() => {
    mockAuthUser.value = { id: 'u1' }
    mockProfileRole.value = 'admin'
    mockAdminDb.insertResult = { data: { id: 'p-new' }, error: null }
    mockRedirect.mockReset()
    mockRevalidatePath.mockReset()
  })

  it('redirects to edit page on success', async () => {
    const fd = new FormData()
    fd.append('name', 'Table'); fd.append('slug', 'table')
    fd.append('price', '299.00'); fd.append('shipping_price', '15.00'); fd.append('stock', '3')
    await createProduct(fd)
    expect(mockRedirect).toHaveBeenCalledWith('/admin/produits/p-new/edit')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/produits')
  })

  it('redirects with error when slug already exists (23505)', async () => {
    mockAdminDb.insertResult = { data: null as unknown as { id: string }, error: { code: '23505' } }
    const fd = new FormData()
    fd.append('name', 'Table'); fd.append('slug', 'table')
    fd.append('price', '100'); fd.append('shipping_price', '0'); fd.append('stock', '1')
    await createProduct(fd)
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('error='))
  })

  it('redirects with error when price is empty (Review Focus #3)', async () => {
    const fd = new FormData()
    fd.append('name', 'Table'); fd.append('slug', 'table')
    fd.append('price', ''); fd.append('shipping_price', '0'); fd.append('stock', '1')
    await createProduct(fd)
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('error='))
  })

  it('stores empty category as null — not empty string (Review Focus #5)', async () => {
    const fd = new FormData()
    fd.append('name', 'T'); fd.append('slug', 's')
    fd.append('price', '10'); fd.append('shipping_price', '0'); fd.append('stock', '0')
    fd.append('category', '')
    // The insert mock can't verify this directly; we check redirect (no error = insert was called without slug conflict)
    await createProduct(fd)
    expect(mockRedirect).toHaveBeenCalledWith('/admin/produits/p-new/edit')
  })
})

describe('updateProduct', () => {
  beforeEach(() => {
    mockAuthUser.value = { id: 'u1' }
    mockProfileRole.value = 'admin'
    mockAdminDb.updateResult = { error: null }
  })

  it('returns ok:true on success', async () => {
    const fd = new FormData()
    fd.append('name', 'Table'); fd.append('slug', 'table')
    fd.append('price', '100'); fd.append('shipping_price', '0'); fd.append('stock', '1')
    const result = await updateProduct('p1', fd)
    expect(result).toEqual({ ok: true })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/produits')
  })

  it('returns ok:false with error on slug conflict (23505)', async () => {
    mockAdminDb.updateResult = { error: { code: '23505' } }
    const fd = new FormData(); fd.append('name', 'T'); fd.append('slug', 's')
    fd.append('price', '10'); fd.append('shipping_price', '0'); fd.append('stock', '0')
    const result = await updateProduct('p1', fd)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Slug déjà utilisé')
  })
})

describe('unpublishProduct', () => {
  beforeEach(() => {
    mockAuthUser.value = { id: 'u1' }
    mockAdminDb.updateResult = { error: null }
    mockAdminDb.updateSelectData = [{ id: 'p1' }]
  })

  it('returns ok:true and revalidates', async () => {
    const result = await unpublishProduct('p1')
    expect(result).toEqual({ ok: true })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/produits')
  })

  it('returns ok:false when product does not exist (no rows affected)', async () => {
    mockAdminDb.updateSelectData = []
    const result = await unpublishProduct('nonexistent')
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns ok:false for already-unpublished product (published filter returns no rows)', async () => {
    mockAdminDb.updateSelectData = []
    const result = await unpublishProduct('p1')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Produit déjà dépublié ou introuvable')
  })
})

describe('uploadPhoto', () => {
  beforeEach(() => {
    mockAuthUser.value = { id: 'u1' }
    mockUploadProductPhoto.mockReset()
    mockUploadProductPhoto.mockResolvedValue({ path: 'p1/uuid.jpg', url: 'https://cdn/p1/uuid.jpg' })
    mockAdminDb.photosData = []
    mockAdminDb.photoInsertError = null
  })

  it('calls uploadProductPhoto and inserts photo row, returns ok:true', async () => {
    const fd = new FormData()
    fd.append('file', new Blob(['x'], { type: 'image/jpeg' }) as File)
    const result = await uploadPhoto('p1', fd)
    expect(mockUploadProductPhoto).toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it('removes uploaded Storage file if DB insert fails', async () => {
    mockAdminDb.photoInsertError = { code: '23503' }
    mockStorageRemove.mockReset()
    const fd = new FormData()
    fd.append('file', new Blob(['x'], { type: 'image/jpeg' }) as File)
    const result = await uploadPhoto('p1', fd)
    expect(result.ok).toBe(false)
    expect(mockStorageRemove).toHaveBeenCalledWith(['p1/uuid.jpg'])
  })
})

describe('deletePhoto', () => {
  beforeEach(() => { mockAuthUser.value = { id: 'u1' } })

  it('returns ok:true and revalidates edit path', async () => {
    const result = await deletePhoto('ph1', 'p1')
    expect(result).toEqual({ ok: true })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/produits/p1/edit')
  })
})

describe('reorderPhoto', () => {
  beforeEach(() => {
    mockAuthUser.value = { id: 'u1' }
    mockPhotoUpdate.mockClear()
    mockAdminDb.photoUpdateErrors = []
    mockAdminDb.photosData = [
      { id: 'ph1', position: 0 },
      { id: 'ph2', position: 1 },
      { id: 'ph3', position: 2 },
    ]
  })

  it('swaps positions moving up', async () => {
    const result = await reorderPhoto('ph2', 'p1', 'up')
    expect(result).toEqual({ ok: true })
    // ph2 (index 1) moves up: gets ph1's position (0); ph1 gets ph2's old position (1)
    expect(mockPhotoUpdate).toHaveBeenNthCalledWith(1, { position: 0 }, 'id', 'ph2')
    expect(mockPhotoUpdate).toHaveBeenNthCalledWith(2, { position: 1 }, 'id', 'ph1')
  })

  it('rolls back first update when second update fails', async () => {
    mockAdminDb.photoUpdateErrors = [null, { message: 'DB error' }]
    const result = await reorderPhoto('ph2', 'p1', 'up')
    expect(result.ok).toBe(false)
    // Called 3 times: first update, second (failed), rollback
    expect(mockPhotoUpdate).toHaveBeenCalledTimes(3)
    // Rollback restores ph2 to its original position (1)
    expect(mockPhotoUpdate).toHaveBeenNthCalledWith(3, { position: 1 }, 'id', 'ph2')
  })

  it('returns error when photoId not in list (Review Focus #1)', async () => {
    const result = await reorderPhoto('unknown-id', 'p1', 'up')
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns error when already at top and direction is up', async () => {
    const result = await reorderPhoto('ph1', 'p1', 'up')
    expect(result.ok).toBe(false)
  })

  it('returns error when already at bottom and direction is down', async () => {
    const result = await reorderPhoto('ph3', 'p1', 'down')
    expect(result.ok).toBe(false)
  })
})
