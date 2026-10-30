import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAdminRealisationById } from '@/lib/data/realisations'
import {
  updateRealisation,
  deleteRealisation,
  uploadPhoto,
  deletePhoto,
} from '@/app/admin/realisations/actions'
import { ConfirmSubmitButton } from '@/components/admin/confirm-submit-button'

export default async function EditRealisationPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string }
}) {
  const realisation = await getAdminRealisationById(params.id)

  if (!realisation) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <Link href="/admin/realisations" className="text-sm text-stone-500 hover:text-stone-700">
        ← Retour à la liste
      </Link>

      <h1 className="text-2xl font-semibold text-stone-900">{realisation.title}</h1>

      {searchParams.error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {searchParams.error}
        </div>
      )}

      {/* Edit form */}
      <form
        action={async (fd) => {
          'use server'
          const result = await updateRealisation(params.id, fd)
          if (!result.ok) {
            redirect(
              `/admin/realisations/${params.id}/edit?error=${encodeURIComponent(result.error ?? 'Erreur lors de la mise à jour')}`
            )
          }
          redirect(`/admin/realisations/${params.id}/edit`)
        }}
        className="space-y-5"
      >
        <div className="space-y-1">
          <label htmlFor="title" className="block text-sm font-medium text-stone-700">
            Titre <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={realisation.title}
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
            defaultValue={realisation.description ?? ''}
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

      {/* Photos section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-stone-900">Photos</h2>

        {realisation.realisation_photos.length === 0 && (
          <p className="text-sm text-stone-500">Aucune photo pour cette réalisation.</p>
        )}

        <div className="space-y-3">
          {realisation.realisation_photos.map((photo) => (
            <div key={photo.id} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="h-20 w-20 rounded object-cover" />

              <form
                action={async () => {
                  'use server'
                  const r = await deletePhoto(photo.id, params.id)
                  if (!r.ok)
                    redirect(
                      `/admin/realisations/${params.id}/edit?error=${encodeURIComponent(r.error ?? 'Erreur')}`
                    )
                  redirect(`/admin/realisations/${params.id}/edit`)
                }}
              >
                <ConfirmSubmitButton
                  message="Supprimer cette photo ?"
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  Supprimer
                </ConfirmSubmitButton>
              </form>
            </div>
          ))}
        </div>

        {/* Upload form */}
        <form
          action={async (fd) => {
            'use server'
            const r = await uploadPhoto(params.id, fd)
            if (!r.ok)
              redirect(
                `/admin/realisations/${params.id}/edit?error=${encodeURIComponent(r.error ?? 'Erreur')}`
              )
            redirect(`/admin/realisations/${params.id}/edit`)
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

      {/* Delete réalisation */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-stone-900">Supprimer la réalisation</h2>
        <form
          action={async () => {
            'use server'
            const r = await deleteRealisation(params.id)
            if (!r.ok)
              redirect(
                `/admin/realisations/${params.id}/edit?error=${encodeURIComponent(r.error ?? 'Erreur lors de la suppression')}`
              )
            redirect('/admin/realisations')
          }}
        >
          <ConfirmSubmitButton
            message="Supprimer cette réalisation et toutes ses photos ? Cette action est irréversible."
            className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Supprimer la réalisation
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  )
}
