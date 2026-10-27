import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrderById } from '@/lib/data/orders'
import { advanceStatus, sendShippingEmail } from '@/app/admin/commandes/[id]/actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const STATUS_LABELS: Record<string, string> = {
  confirmee: 'Confirmée',
  expediee: 'Expédiée',
  livree: 'Livrée',
  echouee: 'Échouée',
  en_attente: 'En attente',
}

const STATUS_CLASSES: Record<string, string> = {
  confirmee: 'bg-blue-100 text-blue-800',
  expediee: 'bg-orange-100 text-orange-800',
  livree: 'bg-green-100 text-green-800',
  echouee: 'bg-red-100 text-red-800',
  en_attente: 'bg-gray-100 text-gray-800',
}

function formatEuros(cents: number): string {
  return (cents / 100).toFixed(2) + ' €'
}

export default async function CommandeDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const order = await getOrderById(params.id)

  if (!order) {
    notFound()
  }

  const address = order.shipping_addresses[0]

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <Link href="/admin/commandes" className="text-sm text-stone-500 hover:text-stone-700">
        ← Retour aux commandes
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold text-stone-900">{order.order_number}</h1>
        <Badge className={STATUS_CLASSES[order.status] ?? 'bg-gray-100 text-gray-800'}>
          {STATUS_LABELS[order.status] ?? order.status}
        </Badge>
        <span className="text-sm text-stone-500">
          {new Date(order.created_at).toLocaleDateString('fr-FR')}
        </span>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-stone-900">Client</h2>
        <p className="text-stone-700">{order.email}</p>
        <p className="text-stone-700">{order.phone ?? '—'}</p>
        {address && (
          <address className="not-italic text-stone-700">
            <p>{address.first_name} {address.last_name}</p>
            <p>{address.line1}</p>
            {address.line2 && <p>{address.line2}</p>}
            <p>{address.postal_code} {address.city}</p>
            <p>{address.country}</p>
          </address>
        )}
      </section>

      <section>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
              <TableHead className="text-right">Prix unitaire</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.order_items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.products.name}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">{formatEuros(item.unit_price_cents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="ml-auto w-full max-w-xs space-y-2 text-sm text-stone-700">
        <div className="flex justify-between">
          <span>Sous-total</span>
          <span>{formatEuros(order.total_cents - order.shipping_cents)}</span>
        </div>
        <div className="flex justify-between">
          <span>Livraison</span>
          <span>{formatEuros(order.shipping_cents)}</span>
        </div>
        <div className="flex justify-between font-semibold text-stone-900">
          <span>Total TTC</span>
          <span>{formatEuros(order.total_cents)}</span>
        </div>
      </section>

      <section>
        {order.status === 'confirmee' && (
          <form
            action={async () => {
              'use server'
              await sendShippingEmail(order.id)
            }}
          >
            <button
              type="submit"
              className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
            >
              Expédier et envoyer email
            </button>
          </form>
        )}

        {order.status === 'expediee' && (
          <form
            action={async () => {
              'use server'
              await advanceStatus(order.id)
            }}
          >
            <button
              type="submit"
              className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
            >
              Marquer comme livrée
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
