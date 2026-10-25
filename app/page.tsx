import Link from 'next/link'
import { getFeaturedProducts, type ProductWithPhotos } from '@/lib/data/products'
import { getRealisations, type RealisationWithPhotos } from '@/lib/data/realisations'

export default async function Home() {
  const [products, realisations] = await Promise.all([
    getFeaturedProducts(),
    getRealisations(),
  ])

  const featuredProducts: ProductWithPhotos[] = products.slice(0, 4)
  const featuredRealisations: RealisationWithPhotos[] = realisations.slice(0, 3)

  return (
    <main>
      {/* Hero */}
      <section className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-stone-200 px-4 py-24 text-center">
        <h1 className="font-serif text-5xl text-stone-800 md:text-6xl">Auguste Woodworking</h1>
        <p className="font-sans text-lg text-stone-600">Objets en bois faits à la main</p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/boutique"
            className="rounded border border-stone-800 px-6 py-3 font-sans text-stone-800 transition hover:bg-stone-800 hover:text-stone-50"
          >
            Voir la boutique
          </Link>
          <Link
            href="/atelier"
            className="rounded border border-stone-800 px-6 py-3 font-sans text-stone-800 transition hover:bg-stone-800 hover:text-stone-50"
          >
            Découvrir l&apos;atelier
          </Link>
        </div>
      </section>

      {/* Produits vedettes */}
      {featuredProducts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-20">
          <p className="font-sans text-sm uppercase tracking-widest text-stone-500">Boutique</p>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => {
              const photo = product.product_photos[0]
              return (
                <Link key={product.id} href={`/boutique/${product.slug}`} className="group flex flex-col gap-3">
                  <div className="aspect-square overflow-hidden bg-stone-200">
                    {photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.url}
                        alt={product.name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    )}
                  </div>
                  <h3 className="font-serif text-xl text-stone-800">{product.name}</h3>
                  <p className="font-sans text-stone-600">{(product.price_cents / 100).toFixed(2)} €</p>
                </Link>
              )
            })}
          </div>
          <div className="mt-10">
            <Link href="/boutique" className="font-sans text-stone-800 underline underline-offset-4">
              Voir tous les produits
            </Link>
          </div>
        </section>
      )}

      {/* Réalisations */}
      {featuredRealisations.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-20">
          <p className="font-sans text-sm uppercase tracking-widest text-stone-500">Réalisations</p>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {featuredRealisations.map((realisation) => {
              const photo = realisation.realisation_photos[0]
              return (
                <div key={realisation.id} className="flex flex-col gap-3">
                  <div className="aspect-[4/3] overflow-hidden bg-stone-200">
                    {photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo.url} alt={realisation.title} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <h3 className="font-serif text-lg text-stone-800">{realisation.title}</h3>
                </div>
              )
            })}
          </div>
          <div className="mt-10">
            <Link href="/realisations" className="font-sans text-stone-800 underline underline-offset-4">
              Voir toutes les réalisations
            </Link>
          </div>
        </section>
      )}

      {/* À propos court */}
      <section className="bg-stone-100 px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl text-stone-800">L&apos;atelier</h2>
          <p className="mt-6 font-sans leading-relaxed text-stone-600">
            Texte de présentation à venir.
          </p>
          <div className="mt-8">
            <Link href="/atelier" className="font-sans text-stone-800 underline underline-offset-4">
              En savoir plus
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
