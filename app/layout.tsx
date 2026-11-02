import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import './globals.css'
import Nav from '@/components/nav'
import Footer from '@/components/footer'
import { CartProvider } from '@/lib/cart/cart-context'
import { cn } from "@/lib/utils";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo/config'
import { Analytics } from '@vercel/analytics/next'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-serif',
})

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, locale: 'fr_FR', type: 'website' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={cn(cormorant.variable, inter.variable, "font-sans")}>
      <body className="antialiased flex flex-col min-h-screen">
        <CartProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
        <Analytics />
      </body>
    </html>
  )
}
