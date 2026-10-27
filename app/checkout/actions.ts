'use server'

import { createClient } from '@/lib/supabase/server'
import { getStripeServer } from '@/lib/stripe/server'

type CheckoutData = {
  coordonnees: { firstName: string; lastName: string; email: string; phone: string }
  adresse: { line1: string; line2?: string; city: string; postalCode: string; country: string }
  items: { productId: string; quantity: number }[]
}

type CreatePIResult =
  | { ok: true; clientSecret: string; orderId: string }
  | { ok: false; error: string }

export async function createPaymentIntent(data: CheckoutData): Promise<CreatePIResult> {
  try {
    const supabase = createClient()

    // 1. Load products from Supabase
    const productIds = data.items.map(i => i.productId)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price_cents, shipping_price_cents, stock, allow_preorder')
      .in('id', productIds)

    if (productsError || !products) {
      return { ok: false, error: 'Erreur lors du chargement des produits' }
    }

    // 2. Verify each item
    for (const item of data.items) {
      const product = products.find(p => p.id === item.productId)
      if (!product) {
        return { ok: false, error: `Produit introuvable: ${item.productId}` }
      }
      if (product.stock === 0 && !product.allow_preorder) {
        return { ok: false, error: `Stock insuffisant pour ${item.productId}` }
      }
    }

    // 3. Compute totals using server-side prices
    let totalCents = 0
    let shippingCents = 0
    for (const item of data.items) {
      const product = products.find(p => p.id === item.productId)!
      totalCents += product.price_cents * item.quantity
      shippingCents += product.shipping_price_cents * item.quantity
    }

    // 4. Generate order number
    const { data: orderNumber, error: rpcError } = await supabase.rpc('generate_order_number')
    if (rpcError || !orderNumber) {
      return { ok: false, error: 'Erreur lors de la génération du numéro de commande' }
    }

    // 5. Create Payment Intent
    const stripe = getStripeServer()
    const pi = await stripe.paymentIntents.create({
      amount: totalCents + shippingCents,
      currency: 'eur',
      metadata: { order_number: orderNumber },
    })

    // 6. Insert order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        status: 'en_attente',
        stripe_payment_intent_id: pi.id,
        total_cents: totalCents,
        shipping_cents: shippingCents,
        customer_email: data.coordonnees.email,
        customer_phone: data.coordonnees.phone,
        customer_first_name: data.coordonnees.firstName,
        customer_last_name: data.coordonnees.lastName,
      })
      .select()
      .single()

    if (orderError || !order) {
      return { ok: false, error: 'Erreur lors de la création de la commande' }
    }

    // 7. Insert order_items
    await supabase.from('order_items').insert(
      data.items.map(item => {
        const product = products.find(p => p.id === item.productId)!
        return {
          order_id: order.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price_cents: product.price_cents,
        }
      })
    )

    // 8. Insert shipping_addresses
    await supabase.from('shipping_addresses').insert({
      order_id: order.id,
      line1: data.adresse.line1,
      line2: data.adresse.line2 ?? null,
      city: data.adresse.city,
      postal_code: data.adresse.postalCode,
      country: data.adresse.country,
    })

    // 9. Return success
    return {
      ok: true,
      clientSecret: pi.client_secret!,
      orderId: order.id,
    }
  } catch {
    return { ok: false, error: 'Erreur inattendue' }
  }
}
