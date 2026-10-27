import Link from 'next/link'
import { getOrders } from '@/lib/data/orders'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const FILTERS = [
  { label: 'Toutes', status: undefined },
  { label: 'Confirmées', status: 'confirmee' },
  { label: 'Expédiées', status: 'expediee' },
  { label: 'Livrées', status: 'livree' },
  { label: 'Échouées', status: 'echouee' },
] as const

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

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const status = searchParams.status
  const orders = await getOrders(status)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-stone-900">Commandes</h1>

      <nav className="flex flex-wrap gap-4 text-sm">
        {FILTERS.map((filter) => {
          const isActive = filter.status === status
          const href = filter.status ? `?status=${filter.status}` : '/admin/commandes'
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
            <TableHead>#</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Total TTC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell>
                <Link href={`/admin/commandes/${order.id}`} className="font-medium text-stone-900 hover:underline">
                  {order.order_number}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/admin/commandes/${order.id}`} className="block">
                  {new Date(order.created_at).toLocaleDateString('fr-FR')}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/admin/commandes/${order.id}`} className="block">
                  {order.email}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/admin/commandes/${order.id}`} className="block">
                  <Badge className={STATUS_CLASSES[order.status] ?? 'bg-gray-100 text-gray-800'}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </Badge>
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/admin/commandes/${order.id}`} className="block">
                  {(order.total_cents / 100).toFixed(2) + ' €'}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
