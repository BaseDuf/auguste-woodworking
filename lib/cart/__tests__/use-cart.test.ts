import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'

// mock localStorage
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
})

import { CartProvider } from '../cart-context'
import { useCartContext } from '../cart-context'

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(CartProvider, null, children)

const mockProduct = {
  id: 'prod-1', slug: 'table', name: 'Table', price_cents: 50000,
  shipping_price_cents: 1500, stock: 3, allow_preorder: false,
  product_photos: [], description: null, category: null,
  published: true, created_at: '2026-01-01',
}

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]) })

describe('addItem', () => {
  it('adds new item with quantity 1', () => {
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => result.current.addItem(mockProduct))
    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].quantity).toBe(1)
  })

  it('increments quantity when same product added twice', () => {
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => { result.current.addItem(mockProduct); result.current.addItem(mockProduct) })
    expect(result.current.items[0].quantity).toBe(2)
  })

  it('caps quantity at stock when allow_preorder is false', () => {
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => {
      result.current.addItem(mockProduct)
      result.current.addItem(mockProduct)
      result.current.addItem(mockProduct)
      result.current.addItem(mockProduct) // 4th — stock is 3
    })
    expect(result.current.items[0].quantity).toBe(3)
  })

  it('allows over-stock quantity when allow_preorder is true', () => {
    const preorderProduct = { ...mockProduct, stock: 0, allow_preorder: true }
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => { result.current.addItem(preorderProduct); result.current.addItem(preorderProduct) })
    expect(result.current.items[0].quantity).toBe(2)
  })
})

describe('removeItem', () => {
  it('removes item by productId', () => {
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => { result.current.addItem(mockProduct); result.current.removeItem('prod-1') })
    expect(result.current.items).toHaveLength(0)
  })
})

describe('updateQty', () => {
  it('removes item when qty set to 0', () => {
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => { result.current.addItem(mockProduct); result.current.updateQty('prod-1', 0) })
    expect(result.current.items).toHaveLength(0)
  })
})

describe('totals', () => {
  it('calculates subtotalCents, shippingCents, grandTotalCents correctly', () => {
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => { result.current.addItem(mockProduct); result.current.addItem(mockProduct) })
    // 2 × 50000 = 100000; 2 × 1500 = 3000; grand = 103000
    expect(result.current.subtotalCents).toBe(100000)
    expect(result.current.shippingCents).toBe(3000)
    expect(result.current.grandTotalCents).toBe(103000)
    expect(result.current.totalItems).toBe(2)
  })
})
