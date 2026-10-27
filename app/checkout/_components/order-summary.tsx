import type { CartItem } from '@/lib/cart/types'
import { formatPrice } from '@/lib/format'
import Image from 'next/image'

type Props = {
  items: CartItem[]
  subtotalCents: number
  shippingCents: number
  grandTotalCents: number
}

export function OrderSummary({ items, subtotalCents, shippingCents, grandTotalCents }: Props) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-stone-900 mb-4">Résumé de la commande</h2>

      <ul className="space-y-3 mb-6">
        {items.map(item => (
          <li key={item.productId} className="flex items-center gap-3">
            {item.photo_url && (
              <Image
                src={item.photo_url}
                alt={item.name}
                width={56}
                height={56}
                className="w-14 h-14 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-900 truncate">{item.name}</p>
              <p className="text-xs text-stone-500">Qté : {item.quantity}</p>
            </div>
            <p className="text-sm text-stone-900 font-medium whitespace-nowrap">
              {formatPrice(item.price_cents * item.quantity)}
            </p>
          </li>
        ))}
      </ul>

      <div className="border-t border-stone-200 pt-4 space-y-2">
        <div className="flex justify-between text-sm text-stone-600">
          <span>Sous-total</span>
          <span>{formatPrice(subtotalCents)}</span>
        </div>
        <div className="flex justify-between text-sm text-stone-600">
          <span>Frais de livraison</span>
          <span>{formatPrice(shippingCents)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-stone-900 pt-2 border-t border-stone-200">
          <span>Total TTC</span>
          <span>{formatPrice(grandTotalCents)}</span>
        </div>
      </div>
    </div>
  )
}
