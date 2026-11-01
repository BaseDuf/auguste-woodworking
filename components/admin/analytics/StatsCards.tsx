import { formatPrice } from '@/lib/format'
import { OrderStats } from '@/lib/data/analytics'

function delta(current: number, prev: number): string {
  if (prev === 0) return '—'
  const pct = ((current - prev) / prev) * 100
  const formatted = pct.toFixed(1) + '%'
  return pct >= 0 ? '+' + formatted : formatted
}

function deltaClass(d: string): string {
  if (d.startsWith('+')) return 'text-green-600'
  if (d === '—') return 'text-stone-400'
  return 'text-red-600'
}

export default function StatsCards({ stats }: { stats: OrderStats }): JSX.Element {
  const prevAvgCents = stats.prevCount > 0 ? stats.prevTotalCents / stats.prevCount : 0

  const caDelta = delta(stats.totalCents, stats.prevTotalCents)
  const countDelta = delta(stats.count, stats.prevCount)
  const avgDelta = stats.prevCount === 0 ? '—' : delta(stats.avgCents, prevAvgCents)

  return (
    <div className="flex flex-wrap gap-4">
      {/* Chiffre d'affaires */}
      <div className="flex-1 min-w-[180px] bg-white border border-stone-200 rounded-lg p-4">
        <p className="text-sm text-stone-500 mb-1">Chiffre d&apos;affaires</p>
        <p className="text-2xl font-semibold text-stone-900">{formatPrice(stats.totalCents)}</p>
        <p className={`text-sm mt-1 ${deltaClass(caDelta)}`}>{caDelta}</p>
      </div>

      {/* Commandes */}
      <div className="flex-1 min-w-[180px] bg-white border border-stone-200 rounded-lg p-4">
        <p className="text-sm text-stone-500 mb-1">Commandes</p>
        <p className="text-2xl font-semibold text-stone-900">{stats.count}</p>
        <p className={`text-sm mt-1 ${deltaClass(countDelta)}`}>{countDelta}</p>
      </div>

      {/* Panier moyen */}
      <div className="flex-1 min-w-[180px] bg-white border border-stone-200 rounded-lg p-4">
        <p className="text-sm text-stone-500 mb-1">Panier moyen</p>
        <p className="text-2xl font-semibold text-stone-900">{formatPrice(stats.avgCents)}</p>
        <p className={`text-sm mt-1 ${deltaClass(avgDelta)}`}>{avgDelta}</p>
      </div>
    </div>
  )
}
