'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import CartIcon from './cart-icon'

const links = [
  { href: '/boutique', label: 'Boutique' },
  { href: '/realisations', label: 'Réalisations' },
  { href: '/atelier', label: "L'atelier" },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 bg-[#F8F6F0] border-b border-[#C8D9C4]">
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16"
        aria-label="Navigation principale"
      >
        <Link
          href="/"
          className="font-serif text-xl font-semibold text-[#2C3E2D] hover:opacity-75 transition-opacity"
        >
          Auguste Woodworking
        </Link>

        <ul className="flex items-center gap-6 list-none m-0 p-0">
          {links.map(({ href, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={[
                    'text-sm transition-colors',
                    isActive
                      ? 'text-[#2C3E2D] font-medium border-b-2 border-[#2C3E2D] pb-0.5'
                      : 'text-[#6B7C6B] hover:text-[#2C3E2D]',
                  ].join(' ')}
                >
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
        <CartIcon />
      </nav>
    </header>
  )
}
