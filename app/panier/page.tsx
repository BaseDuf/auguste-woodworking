'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCartContext } from '@/lib/cart/cart-context'
import { formatPrice } from '@/lib/format'

export default function PanierPage() {
  const { items, subtotalCents, shippingCents, grandTotalCents, removeItem, updateQty } = useCartContext()

  if (items.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="font-serif text-3xl text-[#2c2420] mb-4">Votre panier est vide.</h1>
        <p className="text-[#6b5e57] mb-8">Découvrez nos créations artisanales.</p>
        <Link
          href="/boutique"
          className="inline-block rounded border border-stone-800 px-6 py-3 font-sans text-stone-800 transition hover:bg-stone-800 hover:text-stone-50"
        >
          Voir la boutique
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="font-serif text-3xl text-[#2c2420] mb-8">Mon panier</h1>

      <ul className="divide-y divide-[#e5e0d8]">
        {items.map((item) => (
          <li key={item.productId} className="flex gap-4 py-6">
            {item.photo_url && (
              <div className="relative w-20 h-20 shrink-0 rounded overflow-hidden bg-[#f5f0eb]">
                <Image src={item.photo_url} alt={item.name} fill className="object-cover" sizes="80px" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-serif text-lg text-[#2c2420] truncate">{item.name}</p>
              <p className="text-sm text-[#6b5e57] mt-0.5">
                {formatPrice(item.price_cents)} / unité
              </p>
              <p className="text-sm text-[#6b5e57]">
                Frais de livraison&nbsp;: {formatPrice(item.shipping_price_cents)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateQty(item.productId, item.quantity - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded border border-[#e5e0d8] text-[#6b5e57] hover:border-[#2c2420] hover:text-[#2c2420] transition-colors"
                  aria-label={`Diminuer la quantité de ${item.name}`}
                >
                  −
                </button>
                <span className="w-6 text-center font-sans text-[#2c2420]">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQty(item.productId, item.quantity + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded border border-[#e5e0d8] text-[#6b5e57] hover:border-[#2c2420] hover:text-[#2c2420] transition-colors"
                  aria-label={`Augmenter la quantité de ${item.name}`}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.productId)}
                className="text-xs text-[#6b5e57] hover:text-red-600 transition-colors underline"
                aria-label={`Supprimer ${item.name} du panier`}
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 border-t border-[#e5e0d8] pt-6 space-y-2">
        <div className="flex justify-between text-sm text-[#6b5e57]">
          <span>Sous-total</span>
          <span>{formatPrice(subtotalCents)}</span>
        </div>
        <div className="flex justify-between text-sm text-[#6b5e57]">
          <span>Frais de livraison</span>
          <span>{formatPrice(shippingCents)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-[#2c2420] pt-2 border-t border-[#e5e0d8]">
          <span>Total TTC</span>
          <span>{formatPrice(grandTotalCents)}</span>
        </div>
      </div>

      <div className="mt-8">
        <Link
          href="/checkout"
          className="block w-full rounded border border-stone-800 px-6 py-3 font-sans text-center text-stone-800 transition hover:bg-stone-800 hover:text-stone-50"
        >
          Passer commande
        </Link>
      </div>
    </main>
  )
}
