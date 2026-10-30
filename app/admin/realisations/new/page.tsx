import Link from 'next/link'
import { createRealisation } from '@/app/admin/realisations/actions'

export default async function NouvelleRealisationPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Link href="/admin/realisations" className="text-sm text-stone-500 hover:text-stone-700">
        ← Retour à la liste
      </Link>

      <h1 className="text-2xl font-semibold text-stone-900">Nouvelle réalisation</h1>

      {searchParams.error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {searchParams.error}
        </div>
      )}

      <form action={createRealisation} className="space-y-5">
        <div className="space-y-1">
          <label htmlFor="title" className="block text-sm font-medium text-stone-700">
            Titre <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            name="title"
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
