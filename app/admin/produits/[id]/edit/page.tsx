import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAdminProductById } from '@/lib/data/products'
import { Badge } from '@/components/ui/badge'
import {
  updateProduct,
  unpublishProduct,
  uploadPhoto,
  deletePhoto,
  reorderPhoto,
} from '@/app/admin/produits/actions'

export default async function EditProduitPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string }
}) {
  const product = await getAdminProductById(params.id)

  if (!product) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <Link href="/admin/produits" className="text-sm text-stone-500 hover:text-stone-700">
        ← Retour à la liste
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold text-stone-900">{product.name}</h1>
        {product.published ? (
          <Badge className="bg-green-100 text-green-800">Publié</Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-800">Non publié</Badge>
        )}
      </header>

      {searchParams.error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {searchParams.error}
        </div>
      )}

      {/* Main edit form */}
      <form
        action={async (fd) => {
          'use server'
          const result = await updateProduct(params.id, fd)
          if (!result.ok) {
            redirect(
              `/admin/produits/${params.id}/edit?error=${encodeURIComponent(result.error ?? 'Erreur lors de la mise à jour')}`
            )
          }
          redirect(`/admin/produits/${params.id}/edit`)
        }}
        className="space-y-5"
      >
        <div className="space-y-1">
          <label htmlFor="name" className="block text-sm font-medium text-stone-700">
            Nom <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={product.name}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="slug" className="block text-sm font-medium text-stone-700">
            Slug <span className="text-red-500">*</span>
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            defaultValue={product.slug}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="description" className="block text-sm font-medium text-stone-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={product.description ?? ''}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="price" className="block text-sm font-medium text-stone-700">
              Prix (€)
            </label>
            <input
              id="price"
              name="price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(product.price_cents / 100).toFixed(2)}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="shipping_price" className="block text-sm font-medium text-stone-700">
              Frais de livraison (€)
            </label>
            <input
              id="shipping_price"
              name="shipping_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(product.shipping_price_cents / 100).toFixed(2)}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="stock" className="block text-sm font-medium text-stone-700">
            Stock
          </label>
          <input
            id="stock"
            name="stock"
            type="number"
            min="0"
            defaultValue={product.stock}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="category" className="block text-sm font-medium text-stone-700">
            Catégorie
          </label>
          <select
            id="category"
            name="category"
            defaultValue={product.category ?? ''}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
          >
            <option value="">— Aucune —</option>
            <option value="ameublement">Ameublement</option>
            <option value="objet">Objet</option>
            <option value="piece_limitee">Pièce limitée</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="allow_preorder"
            name="allow_preorder"
            type="checkbox"
            value="on"
            defaultChecked={product.allow_preorder}
            className="h-4 w-4 rounded border-stone-300 text-stone-900"
          />
          <label htmlFor="allow_preorder" className="text-sm font-medium text-stone-700">
            Autoriser la précommande
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="published"
            name="published"
            type="checkbox"
            value="on"
            defaultChecked={product.published}
            className="h-4 w-4 rounded border-stone-300 text-stone-900"
          />
          <label htmlFor="published" className="text-sm font-medium text-stone-700">
            Publié
          </label>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
          >
            Enregistrer
          </button>
        </div>
      </form>

      {/* Photos section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-stone-900">Photos</h2>

        {product.product_photos.length === 0 && (
          <p className="text-sm text-stone-500">Aucune photo pour ce produit.</p>
        )}

        <div className="space-y-3">
          {product.product_photos.map((photo, idx) => (
            <div key={photo.id} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="h-20 w-20 rounded object-cover" />

              <div className="flex flex-col gap-1">
                {idx > 0 && (
                  <form
                    action={async () => {
                      'use server'
                      const r = await reorderPhoto(photo.id, product.id, 'up')
                      if (!r.ok) redirect(`/admin/produits/${product.id}/edit?error=${encodeURIComponent(r.error ?? 'Erreur')}`)
                      redirect(`/admin/produits/${product.id}/edit`)
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100"
                    >
                      ↑
                    </button>
                  </form>
                )}
                {idx < product.product_photos.length - 1 && (
                  <form
                    action={async () => {
                      'use server'
                      const r = await reorderPhoto(photo.id, product.id, 'down')
                      if (!r.ok) redirect(`/admin/produits/${product.id}/edit?error=${encodeURIComponent(r.error ?? 'Erreur')}`)
                      redirect(`/admin/produits/${product.id}/edit`)
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100"
                    >
                      ↓
                    </button>
                  </form>
                )}
              </div>

              <form
                action={async () => {
                  'use server'
                  const r = await deletePhoto(photo.id, product.id)
                  if (!r.ok) redirect(`/admin/produits/${product.id}/edit?error=${encodeURIComponent(r.error ?? 'Erreur')}`)
                  redirect(`/admin/produits/${product.id}/edit`)
                }}
              >
                <button
                  type="submit"
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  Supprimer
                </button>
              </form>
            </div>
          ))}
        </div>

        {/* Upload form */}
        <form
          action={async (fd) => {
            'use server'
            const r = await uploadPhoto(product.id, fd)
            if (!r.ok) redirect(`/admin/produits/${product.id}/edit?error=${encodeURIComponent(r.error ?? 'Erreur')}`)
            redirect(`/admin/produits/${product.id}/edit`)
          }}
          className="flex items-center gap-3"
        >
          <input
            type="file"
            name="file"
            accept="image/*"
            required
            className="text-sm text-stone-700 file:mr-3 file:rounded file:border-0 file:bg-stone-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-stone-700"
          />
          <button
            type="submit"
            className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
          >
            Ajouter une photo
          </button>
        </form>
      </section>

      {/* Unpublish */}
      {product.published && (
        <section>
          <form
            action={async () => {
              'use server'
              const r = await unpublishProduct(product.id)
              if (!r.ok) redirect(`/admin/produits/${product.id}/edit?error=${encodeURIComponent(r.error ?? 'Erreur')}`)
              redirect(`/admin/produits/${product.id}/edit`)
            }}
          >
            <button
              type="submit"
              className="rounded border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Dépublier
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
