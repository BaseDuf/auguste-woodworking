import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database.types'

type Realisation = Database['public']['Tables']['realisations']['Row']
type RealisationPhoto = Database['public']['Tables']['realisation_photos']['Row']

export type RealisationWithPhotos = Realisation & { realisation_photos: RealisationPhoto[] }

export async function getRealisations(): Promise<RealisationWithPhotos[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('realisations')
    .select('*, realisation_photos(*)')
    .order('created_at', { ascending: false })
    .order('position', { ascending: true, referencedTable: 'realisation_photos' })
  if (error) console.error('[data:realisations] getRealisations', error)
  return (data as RealisationWithPhotos[] | null) ?? []
}

export async function getAdminRealisations(): Promise<RealisationWithPhotos[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('realisations')
    .select('*, realisation_photos(*)')
    .order('created_at', { ascending: false })
    .order('position', { ascending: true, referencedTable: 'realisation_photos' })
  if (error) console.error('[data:realisations] getAdminRealisations', error)
  return (data as RealisationWithPhotos[] | null) ?? []
}

export async function getAdminRealisationById(id: string): Promise<RealisationWithPhotos | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('realisations')
    .select('*, realisation_photos(*)')
    .eq('id', id)
    .order('position', { ascending: true, referencedTable: 'realisation_photos' })
    .single()
  if (error) {
    if (error.code !== 'PGRST116') console.error('[data:realisations] getAdminRealisationById', error)
    return null
  }
  return data as RealisationWithPhotos
}
