import Link from 'next/link'
import { getPublishedProducts, type ProductWithPhotos } from '@/lib/data/products'

type Category = NonNullable<ProductWithPhotos['category']>

const categories: { value: Category | undefined; label: string }[] = [
  { value: undefined, label: 'Tous' },
  { value: 'ameublement', label: 'Ameublement' },
  { value: 'objet', label: 'Objets' },
  { value: 'piece_limitee', label: 'Pièces limitées' },
]

const categoryLabels: Record<Category, string> = {
  ameublement: 'Ameublement',
  objet: 'Objet',
  piece_limitee: 'Pièce limitée',
}

const validCategories = categories
  .map((c) => c.value)
  .filter((v): v is Category => v !== undefined)

function parseCategory(value: string | undefined): Category | undefined {
  return validCategories.find((c) => c === value)
}

export default async function BoutiquePage({
  searchParams,
}: {
  searchParams: { categorie?: string }
}) {
  const category = parseCategory(searchParams.categorie)
  const products = await getPublishedProducts(category)

  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-serif text-4xl text-stone-800">Boutique</h1>

      <nav aria-label="Filtrer par catégorie" className="mt-8 flex flex-wrap gap-3">
        {categories.map(({ value, label }) => {
          const active = value === category
          const href = value ? `/boutique?categorie=${value}` : '/boutique'
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`rounded border px-4 py-2 font-sans text-sm transition ${
                active
                  ? 'border-stone-800 bg-stone-800 text-stone-50'
                  : 'border-stone-300 text-stone-700 hover:border-stone-800'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {products.length === 0 ? (
        <p className="mt-16 text-center font-sans text-stone-600">
          Aucun produit disponible pour l&apos;instant.
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const photo = product.product_photos[0]
            return (
              <Link
                key={product.id}
                href={`/boutique/${product.slug}`}
                className="group flex flex-col gap-3"
              >
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
                {product.category && (
                  <span className="font-sans text-xs uppercase tracking-widest text-stone-500">
                    {categoryLabels[product.category]}
                  </span>
                )}
                <h2 className="font-serif text-xl text-stone-800">{product.name}</h2>
                <p className="font-sans text-stone-600">
                  {(product.price_cents / 100).toFixed(2)} €
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
