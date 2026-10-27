import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripeServer } from '@/lib/stripe/server'
import { createClient } from '@/lib/supabase/server'
import { sendOrderConfirmation } from '@/lib/email/send-order-confirmation'

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature') ?? ''
  const body = await request.text()

  let event: Stripe.Event
  try {
    event = getStripeServer().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createClient()

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent

      // Fetch order
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('*, order_items(*, products(name)), shipping_addresses(*)')
        .eq('stripe_payment_intent_id', pi.id)
        .single()

      if (fetchError || !order) {
        break
      }

      // Idempotency guard
      if (order.status !== 'en_attente') {
        break
      }

      // Update order status to confirmed
      await supabase
        .from('orders')
        .update({ status: 'confirmee' })
        .eq('id', order.id)

      // Decrement stock for each item
      for (const item of order.order_items ?? []) {
        await supabase.rpc('decrement_product_stock', {
          p_product_id: item.product_id,
          p_qty: item.quantity,
        })
      }

      // Send confirmation email
      await sendOrderConfirmation(order)
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent

      await supabase
        .from('orders')
        .update({ status: 'echouee' })
        .eq('stripe_payment_intent_id', pi.id)
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
