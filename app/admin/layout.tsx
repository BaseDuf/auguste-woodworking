import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = data as Profile | null

  if (!profile || profile.role !== 'admin') {
    redirect('/admin/login')
  }

  return (
    <div>
      <nav className="flex gap-4 p-4 border-b">
        <Link href="/admin/commandes" className="text-stone-700 hover:text-stone-900">
          Commandes
        </Link>
        <Link href="/admin/produits" className="text-stone-700 hover:text-stone-900">
          Produits
        </Link>
      </nav>
      {children}
    </div>
  )
}
