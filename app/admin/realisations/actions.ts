'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { uploadRealisationPhoto } from '@/lib/storage/upload-realisation-photo'

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

export async function createRealisation(formData: FormData): Promise<void> {
  await requireAdmin()

  const title = formData.get('title') as string
  const description = (formData.get('description') as string) || null

  const { data, error } = await createAdminClient()
    .from('realisations')
    .insert({ title, description })
    .select()
    .single()

  if (error || !data) {
    redirect('/admin/realisations/new?error=' + encodeURIComponent('Erreur lors de la création'))
    return
  }

  revalidatePath('/realisations')
  revalidatePath('/admin/realisations')
  redirect('/admin/realisations/' + data.id + '/edit')
}

export async function updateRealisation(
  id: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  const title = formData.get('title') as string
  const description = (formData.get('description') as string) || null

  const { error } = await createAdminClient()
    .from('realisations')
    .update({ title, description })
    .eq('id', id)

  if (error) {
    return { ok: false, error: 'Erreur lors de la mise à jour' }
  }

  revalidatePath('/realisations')
  revalidatePath('/admin/realisations')
  revalidatePath('/admin/realisations/' + id + '/edit')
  return { ok: true }
}

export async function deleteRealisation(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  const supabase = createAdminClient()

  const { data: photos, error: fetchError } = await supabase
    .from('realisation_photos')
    .select('id, url')
    .eq('realisation_id', id)

  if (fetchError) {
    return { ok: false, error: 'Erreur lors de la suppression' }
  }

  const paths = (photos ?? [])
    .map((photo) => {
      const segment = new URL(photo.url).pathname.split('/realisation-photos/')[1]
      return segment
    })
    .filter((p): p is string => Boolean(p))

  if (paths.length > 0) {
    await supabase.storage.from('realisation-photos').remove(paths)
  }

  const { error: deleteError } = await supabase
    .from('realisations')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return { ok: false, error: 'Erreur lors de la suppression' }
  }

  revalidatePath('/realisations')
  revalidatePath('/admin/realisations')
  return { ok: true }
}

export async function uploadPhoto(
  realisationId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  const supabase = createAdminClient()
  const file = formData.get('file') as File

  let uploadResult: { path: string; url: string }
  try {
    uploadResult = await uploadRealisationPhoto(realisationId, file)
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }

  const { path, url } = uploadResult

  const { data: lastPhotos } = await supabase
    .from('realisation_photos')
    .select('position')
    .eq('realisation_id', realisationId)
    .limit(1)
    .order('position', { ascending: false })

  const position = ((lastPhotos as { position: number }[] | null)?.[0]?.position ?? -1) + 1

  const { error: insertError } = await supabase
    .from('realisation_photos')
    .insert({ realisation_id: realisationId, url, position })

  if (insertError) {
    await supabase.storage.from('realisation-photos').remove([path])
    return { ok: false, error: "Erreur lors de l'enregistrement de la photo" }
  }

  revalidatePath('/realisations')
  revalidatePath('/admin/realisations')
  revalidatePath('/admin/realisations/' + realisationId + '/edit')
  return { ok: true }
}

export async function deletePhoto(
  photoId: string,
  realisationId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  const supabase = createAdminClient()

  const { data: photo, error: fetchError } = await supabase
    .from('realisation_photos')
    .select('id, url')
    .eq('id', photoId)
    .single()

  if (fetchError || !photo) {
    return { ok: false, error: 'Erreur lors de la suppression' }
  }

  const segment = new URL(photo.url).pathname.split('/realisation-photos/')[1]
  if (segment) {
    await supabase.storage.from('realisation-photos').remove([segment])
  }

  const { error } = await supabase
    .from('realisation_photos')
    .delete()
    .eq('id', photoId)

  if (error) {
    return { ok: false, error: 'Erreur lors de la suppression' }
  }

  revalidatePath('/realisations')
  revalidatePath('/admin/realisations')
  revalidatePath('/admin/realisations/' + realisationId + '/edit')
  return { ok: true }
}
