# Analytics Dashboard — Design Spec

## Goal

Fournir à l'administrateur d'Auguste Woodworking un tableau de bord `/admin/dashboard` affichant les métriques de ventes calculées depuis Supabase, avec un sélecteur de période (7j / 30j / 90j / 12 mois) et un lien vers le dashboard Vercel Analytics pour les statistiques de visites.

## Architecture

### Page et routing

- Route : `/admin/dashboard` — Server Component Next.js 14 App Router
- Protégée par le même middleware d'auth admin que les autres pages `/admin/*`
- `searchParams.period` : `'7d' | '30d' | '90d' | '12m'` (défaut : `'30d'`)
- La page calcule `from` et `to` à partir de `period`, appelle les 3 fonctions data en parallèle avec `Promise.all`, et passe les résultats aux composants

### Navigation admin

- Lien "Dashboard" ajouté en première position dans `app/admin/layout.tsx` (avant Commandes, Produits, Réalisations)

### Vercel Analytics (tracking)

- Installer `@vercel/analytics` via npm
- Ajouter `<Analytics />` depuis `@vercel/analytics/next` dans `app/layout.tsx` — une seule ligne, active le tracking sur toutes les pages

## Données (`lib/data/analytics.ts`)

### `getOrderStats(from: Date, to: Date): Promise<OrderStats>`

Requête Supabase sur `orders` filtrée par `created_at` dans `[from, to]` et `status != 'echouee'`.

Retourne :
```ts
interface OrderStats {
  totalCents: number      // somme de total_cents
  count: number           // nb de commandes
  avgCents: number        // totalCents / count (0 si count = 0)
  prevTotalCents: number  // même calcul pour la période précédente de même durée
  prevCount: number
}
```

La période précédente a la même durée : `prevFrom = from - duration`, `prevTo = from - 1ms`.

### `getOrdersByStatus(): Promise<Record<OrderStatus, number>>`

Retourne le compteur de commandes actives (toutes périodes confondues) par statut :
```ts
type OrderStatus = 'en_attente' | 'confirmee' | 'expediee' | 'livree' | 'echouee'
```
Toutes les clés sont présentes, valeur 0 si aucune commande.

### `getRevenueTimeSeries(from: Date, to: Date, granularity: 'day' | 'week' | 'month'): Promise<RevenuePoint[]>`

```ts
interface RevenuePoint {
  date: string      // ISO 8601 : YYYY-MM-DD (day), YYYY-Www (week), YYYY-MM (month)
  totalCents: number
}
```

Groupement côté Supabase via `date_trunc` PostgreSQL (`to_char` pour le label). Commandes avec `status != 'echouee'` uniquement. Points à zéro inclus pour les jours/semaines/mois sans commandes (générés côté JS après la requête).

Granularité selon la période :
- `7d` → `day`
- `30d` → `day`
- `90d` → `week`
- `12m` → `month`

## Composants UI

### `components/admin/analytics/PeriodSelector.tsx` (Client Component)

4 boutons : `7j` / `30j` / `90j` / `12 mois`. Le bouton actif est mis en valeur (style filled). Au clic : `router.push('/admin/dashboard?period=<value>')`. Reçoit `currentPeriod: string` en prop.

### `components/admin/analytics/StatsCards.tsx` (Server Component)

3 cartes côte à côte (flex, wrap sur mobile) :

| Carte | Valeur | Delta |
|-------|--------|-------|
| Chiffre d'affaires | `formatCents(totalCents)` en € | `+(x%)` vert / `-(x%)` rouge vs période précédente |
| Commandes | `count` | idem |
| Panier moyen | `formatCents(avgCents)` | idem |

Delta = `(current - prev) / prev * 100`, affiché avec 1 décimale. Si `prev = 0` : afficher `—`.

Props : `stats: OrderStats`.

### `components/admin/analytics/RevenueChart.tsx` (Client Component)

`BarChart` Recharts avec :
- Axe X : labels de dates formatés (`dd/MM` pour day, `Sem. N` pour week, `MMM` pour month)
- Axe Y : valeurs en € (entiers)
- Tooltip : date + `XX,XX €`
- Couleur : accent du design system existant (variable CSS `--accent` ou couleur primaire)
- Responsive : `ResponsiveContainer` largeur 100 %

Props : `data: RevenuePoint[], granularity: 'day'|'week'|'month'`.

### `components/admin/analytics/StatusSummary.tsx` (Server Component)

Tableau ou liste 5 lignes, une par statut, avec compteur et badge coloré :
- `en_attente` → jaune
- `confirmee` → bleu
- `expediee` → orange
- `livree` → vert
- `echouee` → rouge

Props : `counts: Record<OrderStatus, number>`.

### `components/admin/analytics/VercelAnalyticsLink.tsx` (Server Component)

Bloc avec titre "Statistiques de visites", texte d'explication, et bouton lien externe `href="https://vercel.com/analytics"` (`target="_blank" rel="noopener"`).

## Layout de la page `/admin/dashboard`

```
[PeriodSelector]
[StatsCards — 3 cartes]
[RevenueChart — pleine largeur]
[StatusSummary]    [VercelAnalyticsLink]  ← côte à côte sur desktop
```

## Tests

### `lib/data/__tests__/analytics.test.ts`

6 tests avec mock Supabase admin client (`vi.mock`) :

1. `getOrderStats` — retourne CA et count corrects depuis les commandes mockées
2. `getOrderStats` — exclut les commandes `echouee`
3. `getOrderStats` — retourne zéros si aucune commande sur la période
4. `getOrdersByStatus` — toutes les clés présentes, valeurs correctes
5. `getRevenueTimeSeries` — retourne les points triés par date
6. `getRevenueTimeSeries` — remplit les jours sans commandes avec 0

### `app/admin/dashboard/__tests__/page.test.tsx`

2 tests :

1. La page rend les 3 KPI cards avec les bonnes valeurs (mock des 3 fonctions data)
2. La page utilise le `period` depuis `searchParams` pour appeler `getOrderStats`

## Global Constraints

- Next.js 14.2 App Router — pas de Pages Router
- TypeScript strict — pas de `any`, pas de `@ts-ignore`
- Vitest pour les tests
- Recharts 2.x (`recharts@^2.12`) — à installer via npm
- `@vercel/analytics` (`@vercel/analytics@^1`) — à installer via npm
- Supabase admin client pour toutes les requêtes analytics (RLS bypassé)
- Formatage monétaire : fonction `formatCents` existante dans `lib/format.ts`
- Palette couleurs : suivre le design system existant (variables CSS du projet)
- Mobile-first : `StatsCards` et le layout bas passent en colonne unique sous 640 px

## Review Focus

1. **Période précédente à cheval sur le mois** : si `from` est le 1er du mois, `prevFrom` peut tomber sur un mois court (février) — vérifier que le calcul `from - duration` est correct en millisecondes et ne tronque pas les jours
2. **Granularité `week` avec `date_trunc`** : PostgreSQL numérote les semaines ISO (lundi = début) — vérifier que le label JS correspond bien à la semaine SQL
3. **Zéros manquants dans la série temporelle** : si Supabase renvoie seulement les jours avec des commandes, les jours vides ne sont pas dans le résultat — le remplissage JS doit couvrir toute la plage `[from, to]`
4. **`count = 0` → `avgCents = 0` sans division par zéro** : cas bord quand aucune commande sur la période
5. **`searchParams.period` invalide** : si un utilisateur passe `?period=xyz`, la page doit utiliser le défaut `'30d'` sans erreur
