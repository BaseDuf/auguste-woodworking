import Link from 'next/link'
import { createProduct } from '@/app/admin/produits/actions'

export default async function NouveauProduitPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Link href="/admin/produits" className="text-sm text-stone-500 hover:text-stone-700">
        ← Retour à la liste
      </Link>

      <h1 className="text-2xl font-semibold text-stone-900">Nouveau produit</h1>

      {searchParams.error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {searchParams.error}
        </div>
      )}

      <form action={createProduct} className="space-y-5">
        <div className="space-y-1">
          <label htmlFor="name" className="block text-sm font-medium text-stone-700">
            Nom <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
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
            defaultValue={0}
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
    </div>
  )
}
