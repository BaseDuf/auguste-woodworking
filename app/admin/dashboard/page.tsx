import { getOrderStats, getOrdersByStatus, getRevenueTimeSeries } from '@/lib/data/analytics'
import PeriodSelector from '@/components/admin/analytics/PeriodSelector'
import StatsCards from '@/components/admin/analytics/StatsCards'
import RevenueChart from '@/components/admin/analytics/RevenueChart'
import StatusSummary from '@/components/admin/analytics/StatusSummary'
import VercelAnalyticsLink from '@/components/admin/analytics/VercelAnalyticsLink'

type Granularity = 'day' | 'week' | 'month'

const VALID_PERIODS = ['7d', '30d', '90d', '12m'] as const
type Period = typeof VALID_PERIODS[number]

function parsePeriod(p: string | string[] | undefined): { period: Period; from: Date; to: Date; granularity: Granularity } {
  const raw = Array.isArray(p) ? p[0] : p
  const period: Period = (VALID_PERIODS as readonly string[]).includes(raw ?? '') ? (raw as Period) : '30d'
  const to = new Date()
  let from: Date
  let granularity: Granularity

  switch (period) {
    case '7d':
      from = new Date(to.getTime() - 7 * 86400000)
      granularity = 'day'
      break
    case '30d':
      from = new Date(to.getTime() - 30 * 86400000)
      granularity = 'day'
      break
    case '90d':
      from = new Date(to.getTime() - 90 * 86400000)
      granularity = 'week'
      break
    case '12m':
      from = new Date(to.getTime() - 365 * 86400000)
      granularity = 'month'
      break
  }

  return { period, from, to, granularity }
}

export default async function DashboardPage({ searchParams }: { searchParams: { period?: string | string[] } }) {
  const { period, from, to, granularity } = parsePeriod(searchParams.period)
  const [stats, statusCounts, series] = await Promise.all([
    getOrderStats(from, to),
    getOrdersByStatus(),
    getRevenueTimeSeries(from, to, granularity),
  ])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-stone-900">Dashboard</h1>
      <PeriodSelector currentPeriod={period} />
      <StatsCards stats={stats} />
      <RevenueChart data={series} granularity={granularity} />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatusSummary counts={statusCounts} />
        <VercelAnalyticsLink />
      </div>
    </div>
  )
}
