import { formatPrice } from '@/lib/format'
import { OrderStats } from '@/lib/data/analytics'

function delta(current: number, prev: number): string {
  if (prev === 0) return '—'
  const pct = ((current - prev) / prev) * 100
  const formatted = pct.toFixed(1) + '%'
  return pct >= 0 ? '+' + formatted : formatted
}

export default function StatsCards({ stats }: { stats: OrderStats }): JSX.Element {
  const prevAvgCents = stats.prevCount > 0 ? stats.prevTotalCents / stats.prevCount : 0

  return (
    <div className="flex flex-wrap gap-4">
      {/* Chiffre d'affaires */}
      <div className="flex-1 min-w-[180px] bg-white border border-stone-200 rounded-lg p-4">
        <p className="text-sm text-stone-500 mb-1">Chiffre d&apos;affaires</p>
        <p className="text-2xl font-semibold text-stone-900">{formatPrice(stats.totalCents)}</p>
        <p className="text-sm mt-1 text-stone-500">{delta(stats.totalCents, stats.prevTotalCents)}</p>
      </div>

      {/* Commandes */}
      <div className="flex-1 min-w-[180px] bg-white border border-stone-200 rounded-lg p-4">
        <p className="text-sm text-stone-500 mb-1">Commandes</p>
        <p className="text-2xl font-semibold text-stone-900">{stats.count}</p>
        <p className="text-sm mt-1 text-stone-500">{delta(stats.count, stats.prevCount)}</p>
      </div>

      {/* Panier moyen */}
      <div className="flex-1 min-w-[180px] bg-white border border-stone-200 rounded-lg p-4">
        <p className="text-sm text-stone-500 mb-1">Panier moyen</p>
        <p className="text-2xl font-semibold text-stone-900">{formatPrice(stats.avgCents)}</p>
        <p className="text-sm mt-1 text-stone-500">
          {stats.prevCount === 0 ? '—' : delta(stats.avgCents, prevAvgCents)}
        </p>
      </div>
    </div>
  )
}
