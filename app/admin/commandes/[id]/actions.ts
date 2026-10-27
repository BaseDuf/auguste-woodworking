'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrderById } from '@/lib/data/orders'
import { sendShippingNotification } from '@/lib/email/send-shipping-notification'

export async function advanceStatus(orderId: string): Promise<{ ok: boolean; error?: string }> {
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
  const order = await getOrderById(orderId)

  if (!order) {
    return { ok: false, error: 'Commande introuvable' }
  }

  await sendShippingNotification(order)
  await advanceStatus(orderId)

  revalidatePath('/admin/commandes')
  return { ok: true }
}
