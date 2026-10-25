import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getProductBySlug } from '@/lib/data/products'
import PhotoCarousel from '@/components/photo-carousel'
import AddToCartButton from '@/components/add-to-cart-button'

type Props = { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug(params.slug)
  return { title: product ? product.name : 'Produit introuvable' }
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug(params.slug)
  if (!product) notFound()

  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
        <PhotoCarousel photos={product.product_photos} />

        <div className="flex flex-col gap-6">
          <h1 className="font-serif text-4xl text-stone-800">{product.name}</h1>
          <p className="font-sans text-2xl text-stone-800">
            {(product.price_cents / 100).toFixed(2)} €
          </p>
          <p className="font-sans text-sm text-stone-500">
            Livraison : {(product.shipping_price_cents / 100).toFixed(2)} €
          </p>
          {product.description && (
            <p className="font-sans leading-relaxed text-stone-600">{product.description}</p>
          )}
          <AddToCartButton product={product} />
        </div>
      </div>
    </main>
  )
}
