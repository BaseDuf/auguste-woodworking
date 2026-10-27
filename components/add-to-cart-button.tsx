'use client'

import { useState } from 'react'
import type { ProductWithPhotos } from '@/lib/data/products'
import { useCartContext } from '@/lib/cart/cart-context'

export default function AddToCartButton({ product }: { product: ProductWithPhotos }) {
  const { addItem } = useCartContext()
  const [added, setAdded] = useState(false)

  const outOfStock = product.stock === 0
  const preorder = outOfStock && product.allow_preorder
  const disabled = outOfStock && !product.allow_preorder

  const baseLabel = disabled ? 'Rupture de stock' : preorder ? 'Précommander' : 'Ajouter au panier'
  const label = added ? 'Ajouté ✓' : baseLabel

  const handleClick = () => {
    addItem(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1000)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="w-full rounded border border-stone-800 px-6 py-3 font-sans text-stone-800 transition hover:bg-stone-800 hover:text-stone-50 disabled:cursor-not-allowed disabled:border-stone-300 disabled:text-stone-400 disabled:hover:bg-transparent disabled:hover:text-stone-400"
    >
      {label}
    </button>
  )
}
