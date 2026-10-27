import { Resend } from 'resend'

export interface OrderForEmailItem {
  products: { name: string }
  quantity: number
  unit_price_cents: number
}

export interface OrderForEmailAddress {
  first_name: string
  last_name: string
  line1: string
  line2: string | null
  city: string
  postal_code: string
  country: string
}

export interface OrderForEmail {
  id: string
  order_number: string
  email: string
  total_cents?: number
  order_items: OrderForEmailItem[]
  shipping_addresses: OrderForEmailAddress[]
}

export async function sendOrderConfirmation(order: OrderForEmail): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[email] RESEND_API_KEY absent — confirmation non envoyée', order.order_number)
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  const address = order.shipping_addresses[0]
  const addressText = address
    ? `${address.first_name} ${address.last_name}\n${address.line1}${address.line2 ? '\n' + address.line2 : ''}\n${address.postal_code} ${address.city}\n${address.country}`
    : 'Adresse non disponible'

  const itemsText = order.order_items
    .map(item => `- ${item.products.name} x${item.quantity} — ${(item.unit_price_cents / 100).toFixed(2)} €`)
    .join('\n')

  const totalText = order.total_cents != null
    ? `\nTotal : ${(order.total_cents / 100).toFixed(2)} €`
    : ''

  const text = `Bonjour,\n\nMerci pour votre commande ${order.order_number}.\n\nArticles :\n${itemsText}${totalText}\n\nAdresse de livraison :\n${addressText}\n\nCordialement,\nAuguste Woodworking`

  try {
    await resend.emails.send({
      from: 'Auguste Woodworking <commandes@auguste-woodworking.fr>',
      to: order.email,
      subject: `Confirmation de commande ${order.order_number}`,
      text,
    })
  } catch (err) {
    console.error('[email] Erreur lors de l\'envoi de la confirmation de commande', err)
  }
}
