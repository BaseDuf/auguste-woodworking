import Link from 'next/link'
import { getAdminProducts } from '@/lib/data/products'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type Category = 'ameublement' | 'objet' | 'piece_limitee'

const CATEGORIES: Category[] = ['ameublement', 'objet', 'piece_limitee']

const FILTERS = [
  { label: 'Tous', category: undefined },
  { label: 'Ameublement', category: 'ameublement' },
  { label: 'Objets', category: 'objet' },
  { label: 'Pièces limitées', category: 'piece_limitee' },
] as const

const CATEGORY_LABELS: Record<string, string> = {
  ameublement: 'Ameublement',
  objet: 'Objet',
  piece_limitee: 'Pièce limitée',
}

const CATEGORY_CLASSES: Record<string, string> = {
  ameublement: 'bg-blue-100 text-blue-800',
  objet: 'bg-green-100 text-green-800',
  piece_limitee: 'bg-purple-100 text-purple-800',
}

export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: { categorie?: string }
}) {
  const raw = searchParams?.categorie
  const category = CATEGORIES.includes(raw as Category) ? (raw as Category) : undefined

  const products = await getAdminProducts(category)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">Produits</h1>
        <Link
          href="/admin/produits/new"
          className="rounded bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700"
        >
          Nouveau produit
        </Link>
      </div>

      <nav className="flex flex-wrap gap-4 text-sm">
        {FILTERS.map((filter) => {
          const isActive = filter.category === category
          const href = filter.category ? `?categorie=${filter.category}` : '/admin/produits'
          return (
            <Link
              key={filter.label}
              href={href}
              className={
                isActive
                  ? 'font-semibold text-stone-900 bg-stone-100 rounded px-2 py-1'
                  : 'text-stone-500 hover:text-stone-700 px-2 py-1'
              }
            >
              {filter.label}
            </Link>
          )
        })}
      </nav>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead>Prix</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-medium text-stone-900">
                {product.name}
              </TableCell>
              <TableCell>
                {product.category ? (
                  <Badge className={CATEGORY_CLASSES[product.category] ?? 'bg-gray-100 text-gray-800'}>
                    {CATEGORY_LABELS[product.category] ?? product.category}
                  </Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-800">—</Badge>
                )}
              </TableCell>
              <TableCell>
                {(product.price_cents / 100).toFixed(2) + ' €'}
              </TableCell>
              <TableCell>
                {product.stock}
              </TableCell>
              <TableCell>
                {product.published ? (
                  <Badge className="bg-green-100 text-green-800">Publié</Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-800">Non publié</Badge>
                )}
              </TableCell>
              <TableCell>
                <Link
                  href={`/admin/produits/${product.id}/edit`}
                  className="text-sm text-stone-500 hover:text-stone-700 hover:underline"
                >
                  Modifier
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
