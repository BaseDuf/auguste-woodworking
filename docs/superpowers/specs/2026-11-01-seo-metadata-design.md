# SEO & Metadata — Auguste Woodworking

**Date:** 2026-11-01
**Statut:** approuvé

## Objectif

Ajouter une couverture SEO complète au site : metadata Next.js par page (title, description, Open Graph, Twitter Card, canonical), données structurées JSON-LD (Organization, Product, BreadcrumbList), sitemap dynamique et robots.txt. Zéro dépendance supplémentaire.

## Architecture

### Fichier de configuration partagé

`lib/seo/config.ts` — source unique de vérité :

```ts
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://auguste-woodworking.fr'
export const SITE_NAME = 'Auguste Woodworking'
export const SITE_DESCRIPTION = 'Objets en bois faits à la main par un menuisier artisan en Allier.'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`
```

L'URL de production est injectée via `NEXT_PUBLIC_SITE_URL`. Avant déploiement, ajouter cette variable dans les paramètres Vercel/hébergeur.

### Image OG par défaut

Un fichier `public/og-default.jpg` (placeholder 1200×630 px) est commité. Il est remplacé par une vraie photo avant le lancement.

### Composant JSON-LD

`components/seo/json-ld.tsx` — composant serveur sans état, rend un `<script type="application/ld+json">` inline. Signature :

```ts
export function JsonLd({ data }: { data: Record<string, unknown> }): JSX.Element
```

Utilisé dans les pages qui ont besoin de données structurées.

---

## Metadata par page

### Pages statiques

Chaque page exporte un objet `metadata: Metadata` avec au minimum `title`, `description`, et les balises OG/Twitter.

| Route | `title` | `description` |
|-------|---------|---------------|
| `/` | `Auguste Woodworking \| Menuisier artisan en Allier` | `Objets en bois faits à la main par un menuisier artisan en Allier.` |
| `/boutique` | `Boutique \| Auguste Woodworking` | `Découvrez nos objets en bois faits à la main.` |
| `/realisations` | `Réalisations \| Auguste Woodworking` | `Aménagements intérieurs, mobilier sur mesure — nos chantiers réalisés.` |
| `/atelier` | `L'Atelier \| Auguste Woodworking` | `Menuisier de formation, basé dans la vallée de la Sioule en Allier.` |
| `/cgv` | `Conditions générales de vente \| Auguste Woodworking` | (aucune — `noindex`) |
| `/mentions-legales` | `Mentions légales \| Auguste Woodworking` | (aucune — `noindex`) |
| `/politique-de-confidentialite` | `Politique de confidentialité \| Auguste Woodworking` | (aucune — `noindex`) |

Les pages légales (`/cgv`, `/mentions-legales`, `/politique-de-confidentialite`) reçoivent `robots: { index: false, follow: false }`.

### Structure OG commune (pages publiques)

```ts
openGraph: {
  title: '…',
  description: '…',
  url: `${SITE_URL}/chemin`,
  siteName: SITE_NAME,
  locale: 'fr_FR',
  type: 'website',
  images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
},
twitter: {
  card: 'summary_large_image',
  title: '…',
  description: '…',
  images: [DEFAULT_OG_IMAGE],
},
alternates: { canonical: `${SITE_URL}/chemin` },
```

### Page produit `/boutique/[slug]` — dynamique

`generateMetadata` remplace le stub actuel (qui ne renvoie que le titre). Il renvoie :

- `title` : `{product.name} | Auguste Woodworking`
- `description` : `product.description` tronqué à 155 caractères, ou fallback `"Objet en bois fait à la main par Auguste Woodworking."`
- `openGraph.type` : `'website'` (pas `'product'` — non supporté nativement par Next.js Metadata)
- `openGraph.images` : première photo du produit (`product.product_photos[0]?.url`) si elle existe, sinon `DEFAULT_OG_IMAGE`
- `alternates.canonical` : `${SITE_URL}/boutique/${product.slug}`
- Produit introuvable : `title: 'Produit introuvable | Auguste Woodworking'`, pas d'OG

---

## JSON-LD (Schema.org)

### `Organization` — homepage `/`

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Auguste Woodworking",
  "url": "https://auguste-woodworking.fr",
  "description": "Objets en bois faits à la main par un menuisier artisan en Allier."
}
```

### `Product` — `/boutique/[slug]`

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{product.name}",
  "description": "{product.description | fallback}",
  "image": "{première photo ou DEFAULT_OG_IMAGE}",
  "offers": {
    "@type": "Offer",
    "price": "{product.price_cents / 100}",
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock"
  }
}
```

`availability` est toujours `InStock` — la gestion de stock est interne et n'est pas exposée publiquement.

### `BreadcrumbList` — `/boutique/[slug]`

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "{SITE_URL}" },
    { "@type": "ListItem", "position": 2, "name": "Boutique", "item": "{SITE_URL}/boutique" },
    { "@type": "ListItem", "position": 3, "name": "{product.name}", "item": "{SITE_URL}/boutique/{slug}" }
  ]
}
```

---

## Sitemap — `app/sitemap.ts`

Retourne les entrées `MetadataRoute.Sitemap` suivantes :

**Routes statiques** (changeFrequency, priority fixes) :

| URL | priority | changeFrequency |
|-----|----------|-----------------|
| `{SITE_URL}` | 1.0 | `'weekly'` |
| `{SITE_URL}/boutique` | 0.9 | `'weekly'` |
| `{SITE_URL}/realisations` | 0.8 | `'monthly'` |
| `{SITE_URL}/atelier` | 0.7 | `'monthly'` |

**Routes dynamiques** — produits publiés via `getPublishedProducts()` :

```ts
{ url: `${SITE_URL}/boutique/${product.slug}`, priority: 0.8, changeFrequency: 'weekly' }
```

Les pages légales (`/cgv`, `/mentions-legales`, `/politique-de-confidentialite`) et les routes admin (`/admin/*`) sont exclues du sitemap.

---

## Robots — `app/robots.ts`

```ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
```

---

## Metadata racine — `app/layout.tsx`

Le `metadata` global existant est enrichi :

```ts
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    locale: 'fr_FR',
    type: 'website',
  },
}
```

Le `template` permet aux pages de ne fournir que leur propre titre sans répéter le nom du site.

---

## Fichiers créés / modifiés

| Fichier | Action |
|---------|--------|
| `lib/seo/config.ts` | Créer |
| `components/seo/json-ld.tsx` | Créer |
| `public/og-default.jpg` | Ajouter (placeholder 1200×630) |
| `app/layout.tsx` | Modifier — enrichir `metadata` |
| `app/page.tsx` | Modifier — ajouter `metadata` + `<JsonLd>` Organization |
| `app/boutique/page.tsx` | Modifier — ajouter `metadata` |
| `app/boutique/[slug]/page.tsx` | Modifier — enrichir `generateMetadata` + `<JsonLd>` Product + BreadcrumbList |
| `app/realisations/page.tsx` | Modifier — ajouter `metadata` |
| `app/atelier/page.tsx` | Modifier — ajouter `metadata` |
| `app/cgv/page.tsx` | Modifier — enrichir `metadata` + `noindex` |
| `app/mentions-legales/page.tsx` | Modifier — enrichir `metadata` + `noindex` |
| `app/politique-de-confidentialite/page.tsx` | Modifier — enrichir `metadata` + `noindex` |
| `app/sitemap.ts` | Créer |
| `app/robots.ts` | Créer |

---

## Contraintes globales

- Next.js 14.2 App Router — API `Metadata` et `generateMetadata` natives uniquement
- TypeScript strict — pas de `any`
- Zéro dépendance supplémentaire
- `NEXT_PUBLIC_SITE_URL` est la seule variable d'env ajoutée
- L'image OG par défaut est un placeholder — non bloquant pour les tests
- Pas de `server-only` (package non installé)
