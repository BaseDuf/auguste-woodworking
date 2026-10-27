'use client'

import Link from 'next/link'
import { useCartContext } from '@/lib/cart/cart-context'

export default function CartIcon() {
  const { totalItems } = useCartContext()

  return (
    <Link href="/panier" className="relative inline-flex items-center p-1 text-[#6b5e57] hover:text-[#2c2420] transition-colors" aria-label="Panier">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      {totalItems > 0 && (
        <span
          data-testid="cart-badge"
          className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs font-semibold leading-none"
        >
          {totalItems}
        </span>
      )}
    </Link>
  )
}
