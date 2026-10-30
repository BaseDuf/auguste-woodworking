import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminRealisations } from '@/lib/data/realisations'
import { deleteRealisation } from '@/app/admin/realisations/actions'
import { ConfirmSubmitButton } from '@/components/admin/confirm-submit-button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function RealisationsPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const realisations = await getAdminRealisations()

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">Réalisations</h1>
        <Link
          href="/admin/realisations/new"
          className="rounded bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700"
        >
          Nouvelle réalisation
        </Link>
      </div>

      {searchParams.error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {searchParams.error}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Photo</TableHead>
            <TableHead>Titre</TableHead>
            <TableHead>Nb photos</TableHead>
            <TableHead>Date</TableHead>
            <TableHead></TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {realisations.map((realisation) => {
            const coverPhoto = realisation.realisation_photos[0]
            return (
              <TableRow key={realisation.id}>
                <TableCell>
                  {coverPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverPhoto.url}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-stone-100" />
                  )}
                </TableCell>
                <TableCell className="font-medium text-stone-900">
                  {realisation.title}
                </TableCell>
                <TableCell>{realisation.realisation_photos.length}</TableCell>
                <TableCell className="text-sm text-stone-500">
                  {new Date(realisation.created_at).toLocaleDateString('fr-FR')}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/realisations/${realisation.id}/edit`}
                    className="text-sm text-stone-500 hover:text-stone-700 hover:underline"
                  >
                    Modifier
                  </Link>
                </TableCell>
                <TableCell>
                  <form
                    action={async () => {
                      'use server'
                      const r = await deleteRealisation(realisation.id)
                      if (!r.ok)
                        redirect(`/admin/realisations?error=${encodeURIComponent(r.error ?? 'Erreur lors de la suppression')}`)
                      redirect('/admin/realisations')
                    }}
                  >
                    <ConfirmSubmitButton
                      message="Supprimer cette réalisation et toutes ses photos ?"
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Supprimer
                    </ConfirmSubmitButton>
                  </form>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
