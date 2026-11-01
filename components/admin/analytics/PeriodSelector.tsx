'use client'

import { useRouter } from 'next/navigation'

const PERIODS = [
  { label: '7j', value: '7d' },
  { label: '30j', value: '30d' },
  { label: '90j', value: '90d' },
  { label: '12 mois', value: '12m' },
]

export default function PeriodSelector({ currentPeriod }: { currentPeriod: string }): JSX.Element {
  const router = useRouter()

  return (
    <div className="flex gap-2 flex-wrap">
      {PERIODS.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => router.push(`/admin/dashboard?period=${value}`)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            value === currentPeriod
              ? 'bg-stone-800 text-white'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
