import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Conditions générales de vente' }

export default function CgvPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl text-stone-800">Conditions générales de vente</h1>
      <p className="mt-8 font-sans text-stone-600">Texte à venir.</p>
    </div>
  )
}
