'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { uploadProductPhoto } from '@/lib/storage/upload-product-photo'

async function requireAdmin(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/admin/login')
    return
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/admin/login')
    return
  }
}

export async function createProduct(formData: FormData): Promise<void> {
  await requireAdmin()

  const name = formData.get('name')
  const slug = formData.get('slug')
  const description = formData.get('description')
  const price = formData.get('price')
  const shipping_price = formData.get('shipping_price')
  const stock = formData.get('stock')
  const allow_preorder = formData.get('allow_preorder')
  const category = formData.get('category')
  const published = formData.get('published')

  if (isNaN(parseFloat(price as string)) || isNaN(parseFloat(shipping_price as string))) {
    redirect('/admin/produits/new?error=' + encodeURIComponent('Prix invalide'))
  }

  const price_cents = Math.round(parseFloat(price as string) * 100)
  const shipping_price_cents = Math.round(parseFloat(shipping_price as string) * 100)
  const category_val = (category as string) || null

  const { data, error } = await createAdminClient()
    .from('products')
    .insert({
      name: name as string,
      slug: slug as string,
      description: description as string || null,
      price_cents,
      shipping_price_cents,
      stock: parseInt(stock as string, 10),
      allow_preorder: allow_preorder === 'on' || allow_preorder === 'true',
      category: category_val as 'ameublement' | 'objet' | 'piece_limitee' | null,
      published: published === 'on' || published === 'true',
    })
    .select()
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      redirect('/admin/produits/new?error=' + encodeURIComponent('Slug déjà utilisé'))
      return
    }
    redirect('/admin/produits/new?error=' + encodeURIComponent('Erreur lors de la création'))
    return
  }

  revalidatePath('/admin/produits')
  redirect(`/admin/produits/${data.id}/edit`)
}

export async function updateProduct(
  productId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  const name = formData.get('name')
  const slug = formData.get('slug')
  const description = formData.get('description')
  const price = formData.get('price')
  const shipping_price = formData.get('shipping_price')
  const stock = formData.get('stock')
  const allow_preorder = formData.get('allow_preorder')
  const category = formData.get('category')
  const published = formData.get('published')

  if (isNaN(parseFloat(price as string)) || isNaN(parseFloat(shipping_price as string))) {
    return { ok: false, error: 'Prix invalide' }
  }

  const price_cents = Math.round(parseFloat(price as string) * 100)
  const shipping_price_cents = Math.round(parseFloat(shipping_price as string) * 100)
  const category_val = (category as string) || null

  const { error } = await createAdminClient()
    .from('products')
    .update({
      name: name as string,
      slug: slug as string,
      description: description as string || null,
      price_cents,
      shipping_price_cents,
      stock: parseInt(stock as string, 10),
      allow_preorder: allow_preorder === 'on' || allow_preorder === 'true',
      category: category_val as 'ameublement' | 'objet' | 'piece_limitee' | null,
      published: published === 'on' || published === 'true',
    })
    .eq('id', productId)

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Slug déjà utilisé' }
    }
    return { ok: false, error: 'Erreur lors de la mise à jour' }
  }

  revalidatePath('/admin/produits')
  revalidatePath(`/admin/produits/${productId}/edit`)
  return { ok: true }
}

export async function unpublishProduct(
  productId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  const { error } = await createAdminClient()
    .from('products')
    .update({ published: false })
    .eq('id', productId)

  if (error) {
    return { ok: false, error: 'Erreur lors de la dépublication' }
  }

  revalidatePath('/admin/produits')
  revalidatePath(`/admin/produits/${productId}/edit`)
  return { ok: true }
}

export async function uploadPhoto(
  productId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  const file = formData.get('file') as File

  let uploadResult: { path: string; url: string }
  try {
    uploadResult = await uploadProductPhoto(productId, file)
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }

  const { path, url } = uploadResult

  // Get MAX position
  const { data: lastPhotos } = await createAdminClient()
    .from('product_photos')
    .select('position')
    .eq('product_id', productId)
    .limit(1)
    .order('position', { ascending: false })

  const position = ((lastPhotos as { position: number }[] | null)?.[0]?.position ?? -1) + 1

  const { error: insertError } = await createAdminClient()
    .from('product_photos')
    .insert({ product_id: productId, url, position })

  if (insertError) {
    // Rollback: remove from storage
    await createAdminClient().storage.from('product-photos').remove([path])
    return { ok: false, error: 'Erreur lors de l\'enregistrement de la photo' }
  }

  revalidatePath(`/admin/produits/${productId}/edit`)
  return { ok: true }
}

export async function deletePhoto(
  photoId: string,
  productId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  const { error } = await createAdminClient()
    .from('product_photos')
    .delete()
    .eq('id', photoId)

  if (error) {
    return { ok: false, error: 'Erreur lors de la suppression' }
  }

  revalidatePath(`/admin/produits/${productId}/edit`)
  return { ok: true }
}

export async function reorderPhoto(
  photoId: string,
  productId: string,
  direction: 'up' | 'down'
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  const { data: photosRaw } = await createAdminClient()
    .from('product_photos')
    .select('id, position')
    .eq('product_id', productId)
    .order('position', { ascending: true })

  const photos = (photosRaw as { id: string; position: number }[] | null) ?? []

  const index = photos.findIndex((p) => p.id === photoId)

  if (index === -1) {
    return { ok: false, error: 'Impossible de déplacer' }
  }

  if (direction === 'up' && index === 0) {
    return { ok: false, error: 'Impossible de déplacer' }
  }

  if (direction === 'down' && index === photos.length - 1) {
    return { ok: false, error: 'Impossible de déplacer' }
  }

  const neighborIdx = direction === 'up' ? index - 1 : index + 1

  // Swap positions
  const newPosA = photos[neighborIdx].position
  const newPosB = photos[index].position

  await createAdminClient().from('product_photos').update({ position: newPosA }).eq('id', photos[index].id)
  await createAdminClient().from('product_photos').update({ position: newPosB }).eq('id', photos[neighborIdx].id)

  revalidatePath(`/admin/produits/${productId}/edit`)
  return { ok: true }
}
