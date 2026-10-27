'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getOrderById } from '@/lib/data/orders'
import { sendShippingNotification } from '@/lib/email/send-shipping-notification'

async function requireAdmin(): Promise<{ authorized: boolean }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { authorized: false }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { authorized: profile?.role === 'admin' }
}

export async function advanceStatus(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const { authorized } = await requireAdmin()
  if (!authorized) return { ok: false, error: 'Non autorisé' }

  const { data: current, error } = await createAdminClient()
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single()

  if (error || !current) {
    return { ok: false, error: 'Commande introuvable' }
  }

  const transitions: Record<string, string> = {
    confirmee: 'expediee',
    expediee: 'livree',
  }

  const next = transitions[current.status]

  if (!next) {
    return { ok: false, error: 'Statut invalide' }
  }

  await createAdminClient()
    .from('orders')
    .update({ status: next })
    .eq('id', orderId)
    .eq('status', current.status)

  revalidatePath('/admin/commandes')
  return { ok: true }
}

export async function sendShippingEmail(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const { authorized } = await requireAdmin()
  if (!authorized) return { ok: false, error: 'Non autorisé' }

  const order = await getOrderById(orderId)

  if (!order) {
    return { ok: false, error: 'Commande introuvable' }
  }

  if (order.status !== 'confirmee') {
    return { ok: false, error: 'Statut invalide' }
  }

  const advance = await advanceStatus(orderId)
  if (!advance.ok) {
    return { ok: false, error: advance.error }
  }

  await sendShippingNotification(order)

  revalidatePath('/admin/commandes')
  return { ok: true }
}
