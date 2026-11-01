'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { formatPrice } from '@/lib/format'
import { RevenuePoint } from '@/lib/data/analytics'

function formatLabel(date: string, granularity: 'day' | 'week' | 'month'): string {
  if (granularity === 'day') {
    return date.substring(8, 10) + '/' + date.substring(5, 7)
  }
  if (granularity === 'week') {
    return 'Sem. ' + parseInt(date.substring(6))
  }
  // month
  return new Date(date + '-01').toLocaleDateString('fr-FR', { month: 'short' })
}

export default function RevenueChart({
  data,
  granularity,
}: {
  data: RevenuePoint[]
  granularity: 'day' | 'week' | 'month'
}): JSX.Element {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => formatLabel(d, granularity)}
            tick={{ fontSize: 12 }}
          />
          <YAxis tickFormatter={(v: number) => formatPrice(v)} tick={{ fontSize: 12 }} width={80} />
          <Tooltip formatter={(v: number) => [formatPrice(v), 'CA']} />
          <Bar dataKey="totalCents" fill="#292524" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
