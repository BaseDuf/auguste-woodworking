import { Resend } from 'resend'
import type { AdminOrderWithItems } from '@/lib/data/orders'

export async function sendShippingNotification(order: AdminOrderWithItems): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[email] RESEND_API_KEY absent — notification d\'expédition non envoyée', order.order_number)
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  const text = `Bonjour,\n\nBonne nouvelle : votre commande ${order.order_number} a été expédiée.\n\nVotre commande sera livrée dans les prochains jours.\n\nCordialement,\nAuguste Woodworking`

  try {
    await resend.emails.send({
      from: 'Auguste Woodworking <commandes@auguste-woodworking.fr>',
      to: order.email,
      subject: `Votre commande ${order.order_number} a été expédiée`,
      text,
    })
  } catch (err) {
    console.error('[email] Erreur lors de l\'envoi de la notification d\'expédition', err)
  }
}
