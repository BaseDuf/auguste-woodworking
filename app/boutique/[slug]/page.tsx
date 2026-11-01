import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getProductBySlug } from '@/lib/data/products'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE, BASE_OPEN_GRAPH } from '@/lib/seo/config'
import { JsonLd } from '@/components/seo/json-ld'
import PhotoCarousel from '@/components/photo-carousel'
import AddToCartButton from '@/components/add-to-cart-button'

type Props = { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug(params.slug)

  if (!product) {
    return { title: { absolute: `Produit introuvable | ${SITE_NAME}` } }
  }

  const description =
    product.description?.slice(0, 155) ?? 'Objet en bois fait à la main par Auguste Woodworking.'
  const ogImage = product.product_photos[0]?.url ?? DEFAULT_OG_IMAGE

  return {
    title: product.name,
    description,
    openGraph: {
      ...BASE_OPEN_GRAPH,
      title: `${product.name} | ${SITE_NAME}`,
      description,
      url: `${SITE_URL}/boutique/${product.slug}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | ${SITE_NAME}`,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: `${SITE_URL}/boutique/${product.slug}`,
    },
  }
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug(params.slug)
  if (!product) notFound()

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description:
      product.description ?? 'Objet en bois fait à la main par Auguste Woodworking.',
    image: product.product_photos[0]?.url ?? DEFAULT_OG_IMAGE,
    offers: {
      '@type': 'Offer',
      price: (product.price_cents / 100).toFixed(2),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Boutique', item: `${SITE_URL}/boutique` },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name,
        item: `${SITE_URL}/boutique/${product.slug}`,
      },
    ],
  }

  return (
    <>
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <div className="mx-auto max-w-6xl px-4 py-16">
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
      </div>
    </>
  )
}
