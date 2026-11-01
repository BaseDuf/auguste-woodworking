import { createAdminClient } from '@/lib/supabase/admin'

export interface OrderStats {
  totalCents: number
  count: number
  avgCents: number
  prevTotalCents: number
  prevCount: number
}

export type OrderStatus = 'en_attente' | 'confirmee' | 'expediee' | 'livree' | 'echouee'

export interface RevenuePoint {
  date: string
  totalCents: number
}

function isoWeekKey(d: Date): string {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function aggregateOrders(data: { total_cents: number }[]): { total: number; count: number } {
  const total = data.reduce((sum, row) => sum + row.total_cents, 0)
  return { total, count: data.length }
}

export async function getOrderStats(from: Date, to: Date): Promise<OrderStats> {
  const supabase = createAdminClient()
  const duration = to.getTime() - from.getTime()
  const prevFrom = new Date(from.getTime() - duration)
  const prevTo = new Date(from.getTime() - 1)

  const [currentResult, prevResult] = await Promise.all([
    supabase
      .from('orders')
      .select('total_cents')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .neq('status', 'echouee'),
    supabase
      .from('orders')
      .select('total_cents')
      .gte('created_at', prevFrom.toISOString())
      .lte('created_at', prevTo.toISOString())
      .neq('status', 'echouee'),
  ])

  if (currentResult.error) {
    console.error('[analytics] Error fetching order stats', currentResult.error)
    throw currentResult.error
  }
  if (prevResult.error) {
    console.error('[analytics] Error fetching prev order stats', prevResult.error)
    throw prevResult.error
  }

  const currentData = (currentResult.data ?? []) as { total_cents: number }[]
  const prevData = (prevResult.data ?? []) as { total_cents: number }[]

  const current = aggregateOrders(currentData)
  const prev = aggregateOrders(prevData)

  return {
    totalCents: current.total,
    count: current.count,
    avgCents: current.count > 0 ? current.total / current.count : 0,
    prevTotalCents: prev.total,
    prevCount: prev.count,
  }
}

export async function getOrdersByStatus(): Promise<Record<OrderStatus, number>> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.from('orders').select('status')

  if (error) {
    console.error('[analytics] Error fetching orders by status', error)
    throw error
  }

  const rows = (data ?? []) as { status: string }[]

  const statuses: OrderStatus[] = ['en_attente', 'confirmee', 'expediee', 'livree', 'echouee']
  const initial: Record<OrderStatus, number> = {
    en_attente: 0,
    confirmee: 0,
    expediee: 0,
    livree: 0,
    echouee: 0,
  }

  return rows.reduce((acc, row) => {
    const status = row.status as OrderStatus
    if (statuses.includes(status)) {
      acc[status] += 1
    }
    return acc
  }, initial)
}

export async function getRevenueTimeSeries(
  from: Date,
  to: Date,
  granularity: 'day' | 'week' | 'month'
): Promise<RevenuePoint[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('orders')
    .select('created_at, total_cents')
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
    .neq('status', 'echouee')

  if (error) {
    console.error('[analytics] Error fetching revenue time series', error)
    throw error
  }

  const rows = (data ?? []) as { created_at: string; total_cents: number }[]

  // Group by key
  const grouped = new Map<string, number>()
  for (const row of rows) {
    const d = new Date(row.created_at)
    let key: string
    if (granularity === 'day') {
      key = d.toISOString().substring(0, 10)
    } else if (granularity === 'month') {
      key = d.toISOString().substring(0, 7)
    } else {
      key = isoWeekKey(d)
    }
    grouped.set(key, (grouped.get(key) ?? 0) + row.total_cents)
  }

  // Generate all periods in range, snapping to bucket boundaries to avoid skips
  const points: RevenuePoint[] = []

  if (granularity === 'day') {
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
    const toDay = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))
    while (cursor <= toDay) {
      const key = cursor.toISOString().substring(0, 10)
      points.push({ date: key, totalCents: grouped.get(key) ?? 0 })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  } else if (granularity === 'week') {
    // Snap to Monday of from's ISO week so we never miss the last week
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
    const dayOfWeek = cursor.getUTCDay() || 7
    cursor.setUTCDate(cursor.getUTCDate() - (dayOfWeek - 1))
    const toWeekKey = isoWeekKey(to)
    while (isoWeekKey(cursor) <= toWeekKey) {
      const key = isoWeekKey(cursor)
      points.push({ date: key, totalCents: grouped.get(key) ?? 0 })
      cursor.setUTCDate(cursor.getUTCDate() + 7)
    }
  } else {
    // Snap to first of from's month to avoid setUTCMonth overflow (e.g. Jan 31 → Mar)
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
    const toKey = to.toISOString().substring(0, 7)
    while (cursor.toISOString().substring(0, 7) <= toKey) {
      const key = cursor.toISOString().substring(0, 7)
      points.push({ date: key, totalCents: grouped.get(key) ?? 0 })
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
  }

  return points
}
