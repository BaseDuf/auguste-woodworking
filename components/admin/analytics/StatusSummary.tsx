import { OrderStatus } from '@/lib/data/analytics'

const STATUS_CONFIG: { status: OrderStatus; label: string; badgeClass: string }[] = [
  { status: 'en_attente', label: 'En attente', badgeClass: 'bg-yellow-100 text-yellow-800' },
  { status: 'confirmee', label: 'Confirmée', badgeClass: 'bg-blue-100 text-blue-800' },
  { status: 'expediee', label: 'Expédiée', badgeClass: 'bg-orange-100 text-orange-800' },
  { status: 'livree', label: 'Livrée', badgeClass: 'bg-green-100 text-green-800' },
  { status: 'echouee', label: 'Échouée', badgeClass: 'bg-red-100 text-red-800' },
]

export default function StatusSummary({
  counts,
}: {
  counts: Record<OrderStatus, number>
}): JSX.Element {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-stone-700 mb-3">Commandes par statut</h3>
      <div className="flex flex-wrap gap-3">
        {STATUS_CONFIG.map(({ status, label, badgeClass }) => (
          <div key={status} className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
              {label}
            </span>
            <span className="text-sm font-semibold text-stone-900">{counts[status]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
