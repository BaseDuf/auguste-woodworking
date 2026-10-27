import Link from 'next/link'

const navLinks = [
  { href: '/boutique', label: 'Boutique' },
  { href: '/realisations', label: 'Réalisations' },
  { href: '/atelier', label: "L'atelier" },
]

const legalLinks = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/cgv', label: 'CGV' },
  { href: '/politique-de-confidentialite', label: 'Politique de confidentialité' },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-[#faf9f7] border-t border-[#e5e0d8] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <p className="font-serif text-lg font-semibold text-[#2c2420] mb-2">
              Auguste Woodworking
            </p>
            <p className="text-sm text-[#6b5e57]">Objets en bois faits à la main.</p>
          </div>

          <nav aria-label="Navigation secondaire">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6b5e57] mb-3">
              Navigation
            </h2>
            <ul className="space-y-2 list-none m-0 p-0">
              {navLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-[#6b5e57] hover:text-[#2c2420] transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6b5e57] mb-3">
              Contact
            </h2>
            <a
              href="mailto:contact@auguste-woodworking.fr"
              className="text-sm text-[#6b5e57] hover:text-[#2c2420] transition-colors"
            >
              contact@auguste-woodworking.fr
            </a>
            <ul className="space-y-2 list-none m-0 p-0 mt-4">
              {legalLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-[#6b5e57] hover:text-[#2c2420] transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#e5e0d8] text-center">
          <p className="text-xs text-[#a09088]">
            &copy; {year} Auguste Woodworking. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  )
}
