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
  if (error) console.error('[data:realisations] getRealisations', error)
  return (data as RealisationWithPhotos[] | null) ?? []
}
