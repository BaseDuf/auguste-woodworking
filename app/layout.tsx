import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter, Geist } from 'next/font/google'
import './globals.css'
import Nav from '@/components/nav'
import Footer from '@/components/footer'
import { CartProvider } from '@/lib/cart/cart-context'
import { cn } from "@/lib/utils";

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-serif',
})

const geist = Geist({subsets:['latin'],variable:'--font-sans'})

export const metadata: Metadata = {
  title: 'Auguste Woodworking',
  description: 'Objets en bois faits à la main',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={cn(cormorant.variable, "font-sans", geist.variable)}>
      <body className="antialiased flex flex-col min-h-screen">
        <CartProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  )
}
