import Link from 'next/link'

const sections = [
  {
    title: "L'histoire d'Auguste",
    body: "Menuisier de formation, Auguste a obtenu son CAP menuiserie avant de travailler plusieurs années dans une entreprise du métier. Fort de cette expérience, il a décidé de se lancer à son compte et d'ouvrir son atelier dans la vallée de la Sioule, en Allier. Depuis, il intervient sur des chantiers en Allier comme à Paris, au gré des projets qui lui sont confiés.",
  },
  {
    title: 'La démarche',
    body: "Auguste travaille avant tout pour des chantiers : aménagements intérieurs, mobilier sur mesure intégré, menuiseries. Chaque projet est pensé en dialogue avec le client, de la conception à la pose. Si vous avez un chantier en tête — une pièce à aménager, un meuble à créer, une rénovation à mener — c'est la bonne adresse.",
  },
  {
    title: 'Les matériaux',
    body: "Auguste travaille avec tous types de bois, avec une préférence marquée pour les essences brutes aux caractères affirmés : chêne, merisier, noyer... Des bois choisis pour leur beauté naturelle, leur solidité et le vieillissement qu'ils offrent dans le temps.",
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
