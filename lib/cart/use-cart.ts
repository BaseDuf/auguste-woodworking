import { useState, useEffect } from 'react'
import type { CartItem } from './types'
import type { ProductWithPhotos } from '@/lib/data/products'

const STORAGE_KEY = 'aw_cart'

export type CartContextValue = {
  items: CartItem[]
  addItem: (product: ProductWithPhotos) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, quantity: number) => void
  clearCart: () => void
  totalItems: number
  subtotalCents: number
  shippingCents: number
  grandTotalCents: number
}

export function useCart(): CartContextValue {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // ignore
    }
  }, [items])

  function addItem(product: ProductWithPhotos) {
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) {
        const newQty = existing.quantity + 1
        const capped = product.allow_preorder ? newQty : Math.min(newQty, product.stock)
        return prev.map(i =>
          i.productId === product.id ? { ...i, quantity: capped } : i
        )
      }
      const newItem: CartItem = {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price_cents: product.price_cents,
        shipping_price_cents: product.shipping_price_cents,
        stock: product.stock,
        allow_preorder: product.allow_preorder,
        photo_url: product.product_photos[0]?.url ?? null,
        quantity: 1,
      }
      return [...prev, newItem]
    })
  }

  function removeItem(productId: string) {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }

  function updateQty(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeItem(productId)
      return
    }
    setItems(prev =>
      prev.map(i => i.productId === productId ? { ...i, quantity } : i)
    )
  }

  function clearCart() {
    setItems([])
  }

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotalCents = items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0)
  const shippingCents = items.reduce((sum, i) => sum + i.shipping_price_cents * i.quantity, 0)
  const grandTotalCents = subtotalCents + shippingCents

  return { items, addItem, removeItem, updateQty, clearCart, totalItems, subtotalCents, shippingCents, grandTotalCents }
}
