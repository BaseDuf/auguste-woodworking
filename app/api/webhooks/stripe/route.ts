import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripeServer } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  const supabase = createAdminClient()

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent

      // Atomic idempotency guard: only update if still en_attente or echouee
      const { data: updated, error: updateError } = await supabase
        .from('orders')
        .update({ status: 'confirmee' })
        .eq('stripe_payment_intent_id', pi.id)
        .in('status', ['en_attente', 'echouee'])
        .select('*, order_items(*, products(name)), shipping_addresses(*)')
        .single()

      if (updateError || !updated) {
        // Already confirmed, or order not found — safe to ack
        break
      }

      // Decrement stock for each item
      for (const item of updated.order_items ?? []) {
        await supabase.rpc('decrement_product_stock', {
          p_product_id: item.product_id,
          p_qty: item.quantity,
        })
      }

      // Send confirmation email
      await sendOrderConfirmation(updated)
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent

      // Only downgrade orders still in en_attente — never downgrade a confirmed order
      await supabase
        .from('orders')
        .update({ status: 'echouee' })
        .eq('stripe_payment_intent_id', pi.id)
        .eq('status', 'en_attente')
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
