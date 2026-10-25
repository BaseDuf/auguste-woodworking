import Link from 'next/link'

const sections = [
  {
    title: "L'histoire d'Auguste",
    body: 'Texte à venir.',
  },
  {
    title: 'La démarche',
    body: 'Texte à venir.',
  },
  {
    title: 'Les matériaux',
    body: 'Texte à venir.',
  },
]

export default function AtelierPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl text-stone-800">L&apos;atelier</h1>

      <div className="mt-12 flex flex-col gap-16">
        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-4">
            <h2 className="font-serif text-2xl text-stone-800">{section.title}</h2>
            <p className="font-sans leading-relaxed text-stone-600">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-16">
        <Link
          href="/boutique"
          className="inline-block rounded border border-stone-800 px-6 py-3 font-sans text-stone-800 transition hover:bg-stone-800 hover:text-stone-50"
        >
          Voir la boutique
        </Link>
      </div>
    </div>
  )
}
