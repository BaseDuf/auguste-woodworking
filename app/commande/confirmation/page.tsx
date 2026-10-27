'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getOrderByPaymentIntentId, type OrderWithItems } from '@/lib/data/orders'
import { formatPrice } from '@/lib/format'
import { useCartContext } from '@/lib/cart/cart-context'

export default function ConfirmationPage() {
  const searchParams = useSearchParams()
  const paymentIntent = searchParams.get('payment_intent') ?? ''
  const redirectStatus = searchParams.get('redirect_status')

  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState(0)
  const [failed, setFailed] = useState(false)

  const { clearCart } = useCartContext()

  useEffect(() => {
    if (redirectStatus === 'failed') {
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadOrder() {
      const result = await getOrderByPaymentIntentId(paymentIntent)
      if (cancelled) return

      if (result) {
        setOrder(result)
        setLoading(false)
        clearCart()
      } else {
        setAttempts((prev) => {
          const next = prev + 1
          if (next >= 3) {
            setLoading(false)
            setFailed(true)
          } else {
            setTimeout(loadOrder, 1000)
          }
          return next
        })
      }
    }

    loadOrder()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentIntent, redirectStatus])

  if (redirectStatus === 'failed') {
    return (
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Paiement refusé</h1>
        <p className="mb-8">Votre paiement a été refusé. Veuillez réessayer.</p>
        <Link href="/checkout" className="underline">
          Retourner au paiement
        </Link>
      </main>
    )
  }

  if (loading || (!order && !failed)) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p>Votre commande est en cours de traitement…</p>
      </main>
    )
  }

  if (failed && !order) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Merci pour votre commande !</h1>
        <p>Votre commande est en cours de traitement. Numéro de référence : {paymentIntent}</p>
        <Link href="/boutique" className="mt-8 inline-block underline">
          Retourner à la boutique
        </Link>
      </main>
    )
  }

  if (!order) return null

  const shippingAddress = order.shipping_addresses[0]

  return (
    <main className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-4">Merci pour votre commande !</h1>

      <p className="text-lg mb-2">
        Numéro de commande :{' '}
        <span className="font-semibold" data-testid="order-number">
          {order.order_number}
        </span>
      </p>

      <p className="mb-8 text-gray-600">
        Un email de confirmation a été envoyé à {order.email}
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Récapitulatif</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Produit</th>
              <th className="text-center py-2">Qté</th>
              <th className="text-right py-2">Prix</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((item, i) => (
              <tr key={i} className="border-b">
                <td className="py-2">{item.products.name}</td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-right">{formatPrice(item.unit_price_cents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="pt-4 font-semibold text-right pr-4">
                Total TTC
              </td>
              <td className="pt-4 font-semibold text-right">
                {formatPrice(order.total_cents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {shippingAddress && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Adresse de livraison</h2>
          <address className="not-italic text-gray-700">
            <p>{shippingAddress.first_name} {shippingAddress.last_name}</p>
            <p>{shippingAddress.line1}</p>
            {shippingAddress.line2 && <p>{shippingAddress.line2}</p>}
            <p>{shippingAddress.postal_code} {shippingAddress.city}</p>
            <p>{shippingAddress.country}</p>
          </address>
        </section>
      )}

      <Link href="/boutique" className="inline-block underline">
        Retourner à la boutique
      </Link>
    </main>
  )
}
