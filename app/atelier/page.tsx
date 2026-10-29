import Link from 'next/link'

const sections = [
  {
    title: "L'histoire d'Auguste",
    body: "Menuisier de formation, j'ai obtenu mon CAP avant de passer plusieurs années dans une entreprise du bâtiment — le temps d'apprendre le métier sur le terrain. Il y a quelques années, j'ai décidé de me lancer à mon compte et d'ouvrir mon atelier dans la vallée de la Sioule, en Allier. Depuis, j'interviens sur des chantiers en Allier, mais aussi jusqu'à Paris.",
  },
  {
    title: 'La démarche',
    body: "Je travaille avant tout pour des chantiers : aménagements intérieurs, menuiseries, mobilier intégré sur mesure. Chaque projet commence par un échange — pour comprendre l'espace, les usages, les envies — et se termine par une pose soignée. Si vous avez un chantier en tête, une pièce à transformer ou un aménagement à réaliser, n'hésitez pas à me contacter.",
  },
  {
    title: 'Les matériaux',
    body: "Je travaille avec toutes les essences de bois, avec une préférence pour les bois bruts aux caractères marqués : chêne, merisier, noyer... Des matières que je choisis pour leur beauté naturelle, leur solidité et le vieillissement qu'elles offrent sur le long terme.",
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
