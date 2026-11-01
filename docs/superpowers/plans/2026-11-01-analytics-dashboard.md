# Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter `/admin/dashboard` avec KPI ventes (CA, commandes, panier moyen), graphique CA dans le temps, résumé par statut, et lien vers Vercel Analytics.

**Architecture:** Server Component Next.js 14 App Router pour la page ; `searchParams.period` contrôle la plage (`7d`/`30d`/`90d`/`12m`, défaut `30d`). Trois fonctions data dans `lib/data/analytics.ts` interrogent Supabase (admin client) et agrègent en JS. Deux Client Components (PeriodSelector, RevenueChart) ; trois Server Components (StatsCards, StatusSummary, VercelAnalyticsLink).

**Tech Stack:** Next.js 14.2, TypeScript strict, Vitest, Recharts 2.x, @vercel/analytics, Supabase admin client

**Spec:** `docs/superpowers/specs/2026-11-01-analytics-dashboard-design.md`

## Global Constraints

- Next.js 14.2 App Router — pas de Pages Router
- TypeScript strict — `any` et `@ts-ignore` interdits
- Vitest + `vi.hoisted` pour les mocks Supabase (pattern existant dans `lib/data/__tests__/orders.test.ts`)
- `recharts@^2.12` — installer via npm
- `@vercel/analytics@^1` — installer via npm
- Supabase admin client (`createAdminClient` depuis `@/lib/supabase/admin`) pour toutes les requêtes analytics
- Formatage monétaire : `formatPrice` depuis `@/lib/format` (la fonction s'appelle `formatPrice`, pas `formatCents`)
- Design system existant : classes Tailwind + couleurs stone du projet
- Mobile-first : colonnes sous 640 px

## Review Focus

1. **Période précédente à cheval sur mois court** : `prevFrom = new Date(from.getTime() - duration)` en millisecondes — vérifier via le test `getOrderStats — calcule correctement la période précédente` (T1)
2. **Zéros manquants dans la série temporelle** : Supabase renvoie seulement les jours avec commandes — le remplissage JS doit couvrir `[from, to]` entier — vérifié par le test `getRevenueTimeSeries — remplit les jours sans commandes avec 0` (T1)
3. **Division par zéro avgCents** : si `count = 0`, `avgCents = 0` sans `/0` — vérifié par le test `getOrderStats — retourne zéros si aucune commande` (T1)
4. **`searchParams.period` invalide** : la page utilise `'30d'` par défaut si la valeur n'est pas parmi `['7d','30d','90d','12m']` — vérifié par le test `DashboardPage — utilise 30d par défaut si period invalide` (T3)
5. **Granularité `week` ISO** : la fonction `isoWeekKey` suit la norme ISO 8601 (lundi = début de semaine) — vérifié par le test `getRevenueTimeSeries — retourne les points triés par date` (T1)

---

### Task 1: Data layer — `lib/data/analytics.ts`

**Files:**
- Create: `lib/data/analytics.ts`
- Test: `lib/data/__tests__/analytics.test.ts`

**Interfaces:**
- Consumes: `createAdminClient` depuis `@/lib/supabase/admin`
- Produces:
  ```ts
  export interface OrderStats {
    totalCents: number
    count: number
    avgCents: number
    prevTotalCents: number
    prevCount: number
  }
  export type OrderStatus = 'en_attente' | 'confirmee' | 'expediee' | 'livree' | 'echouee'
  export interface RevenuePoint { date: string; totalCents: number }
  export async function getOrderStats(from: Date, to: Date): Promise<OrderStats>
  export async function getOrdersByStatus(): Promise<Record<OrderStatus, number>>
  export async function getRevenueTimeSeries(from: Date, to: Date, granularity: 'day' | 'week' | 'month'): Promise<RevenuePoint[]>
  ```

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// lib/data/__tests__/analytics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
}))

vi.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: self,
    gte: self,
    lte: self,
    neq: self,
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(state.result).then(resolve, reject),
  })
  return { createAdminClient: () => ({ from: () => chain }) }
})

import { getOrderStats, getOrdersByStatus, getRevenueTimeSeries } from '../analytics'

beforeEach(() => {
  state.result = { data: null, error: null }
})

describe('getOrderStats', () => {
  it('retourne CA et count corrects', async () => {
    state.result = {
      data: [
        { total_cents: 5000 },
        { total_cents: 3000 },
      ],
      error: null,
    }
    const from = new Date('2026-10-01')
    const to = new Date('2026-10-31')
    const result = await getOrderStats(from, to)
    expect(result.totalCents).toBe(8000)
    expect(result.count).toBe(2)
    expect(result.avgCents).toBe(4000)
  })

  it('retourne zéros si aucune commande sur la période', async () => {
    state.result = { data: [], error: null }
    const result = await getOrderStats(new Date('2026-10-01'), new Date('2026-10-31'))
    expect(result.totalCents).toBe(0)
    expect(result.count).toBe(0)
    expect(result.avgCents).toBe(0)
  })

  it('calcule correctement la période précédente', async () => {
    // Période : oct (31 jours) → prév : sept
    state.result = { data: [], error: null }
    const from = new Date('2026-10-01T00:00:00.000Z')
    const to = new Date('2026-10-31T23:59:59.999Z')
    const result = await getOrderStats(from, to)
    expect(result.prevTotalCents).toBe(0)
    expect(result.prevCount).toBe(0)
  })
})

describe('getOrdersByStatus', () => {
  it('retourne toutes les clés présentes avec valeurs correctes', async () => {
    state.result = {
      data: [
        { status: 'confirmee' },
        { status: 'confirmee' },
        { status: 'expediee' },
      ],
      error: null,
    }
    const result = await getOrdersByStatus()
    expect(result.confirmee).toBe(2)
    expect(result.expediee).toBe(1)
    expect(result.en_attente).toBe(0)
    expect(result.livree).toBe(0)
    expect(result.echouee).toBe(0)
  })
})

describe('getRevenueTimeSeries', () => {
  it('retourne les points triés par date avec granularité day', async () => {
    state.result = {
      data: [
        { created_at: '2026-10-03T10:00:00Z', total_cents: 1000 },
        { created_at: '2026-10-01T08:00:00Z', total_cents: 2000 },
        { created_at: '2026-10-03T14:00:00Z', total_cents: 500 },
      ],
      error: null,
    }
    const from = new Date('2026-10-01')
    const to = new Date('2026-10-03')
    const result = await getRevenueTimeSeries(from, to, 'day')
    expect(result[0].date).toBe('2026-10-01')
    expect(result[0].totalCents).toBe(2000)
    expect(result[2].date).toBe('2026-10-03')
    expect(result[2].totalCents).toBe(1500)
  })

  it('remplit les jours sans commandes avec 0', async () => {
    state.result = {
      data: [{ created_at: '2026-10-01T10:00:00Z', total_cents: 1000 }],
      error: null,
    }
    const from = new Date('2026-10-01')
    const to = new Date('2026-10-03')
    const result = await getRevenueTimeSeries(from, to, 'day')
    expect(result).toHaveLength(3)
    expect(result[1].totalCents).toBe(0) // 2026-10-02
    expect(result[2].totalCents).toBe(0) // 2026-10-03
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run lib/data/__tests__/analytics.test.ts
```
Expected: FAIL — `Cannot find module '../analytics'`

- [ ] **Step 3: Implémenter `lib/data/analytics.ts`**

Exporter les types `OrderStats`, `OrderStatus`, `RevenuePoint`.

`getOrderStats(from, to)` :
- Durée : `duration = to.getTime() - from.getTime()`
- Deux requêtes Supabase en parallèle via `Promise.all` :
  - Période courante : `created_at >= from.toISOString()` ET `<= to.toISOString()` ET `neq('status','echouee')`, `select('total_cents')`
  - Période précédente : `prevFrom = new Date(from.getTime() - duration)`, `prevTo = new Date(from.getTime() - 1)`, mêmes filtres
- Agréger les résultats (`reduce` sur `total_cents`), calculer `avgCents = count > 0 ? total / count : 0`

`getOrdersByStatus()` :
- `select('status')`, pas de filtre de date
- Compter avec `reduce`, initialiser toutes les clés à 0

`getRevenueTimeSeries(from, to, granularity)` :
- `select('created_at, total_cents')` + filtres date + `neq('status','echouee')`
- Grouper en JS selon `granularity` :
  - `'day'` → clé `YYYY-MM-DD` via `date.toISOString().substring(0, 10)`
  - `'month'` → clé `YYYY-MM` via `date.toISOString().substring(0, 7)`
  - `'week'` → fonction helper `isoWeekKey(date)` :
    ```ts
    function isoWeekKey(d: Date): string {
      const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      const day = utc.getUTCDay() || 7
      utc.setUTCDate(utc.getUTCDate() + 4 - day)
      const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
      const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
    }
    ```
- Générer toutes les dates dans `[from, to]` à la granularité donnée, mapper sur le groupe ou 0 :
  - `'day'` : incrémenter de 1 jour jusqu'à `to`
  - `'week'` : incrémenter de 7 jours
  - `'month'` : incrémenter le mois de 1
- Retourner les points triés par date (déjà triés si générés en ordre)

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npx vitest run lib/data/__tests__/analytics.test.ts
```
Expected: PASS (6 tests)

- [ ] **Step 5: Vérifier la suite complète**

```bash
npx vitest run
```
Expected: tous les tests passent

- [ ] **Step 6: Commit**

```bash
git add lib/data/analytics.ts lib/data/__tests__/analytics.test.ts
git commit -m "feat: data layer analytics — getOrderStats, getOrdersByStatus, getRevenueTimeSeries"
```

---

### Task 2: Composants UI analytics

**Files:**
- Create: `components/admin/analytics/PeriodSelector.tsx`
- Create: `components/admin/analytics/StatsCards.tsx`
- Create: `components/admin/analytics/RevenueChart.tsx`
- Create: `components/admin/analytics/StatusSummary.tsx`
- Create: `components/admin/analytics/VercelAnalyticsLink.tsx`

**Interfaces:**
- Consumes (T1): `OrderStats`, `OrderStatus`, `RevenuePoint`
- Produces (T3 consomme):
  ```ts
  // PeriodSelector
  export default function PeriodSelector({ currentPeriod }: { currentPeriod: string }): JSX.Element
  // StatsCards
  export default function StatsCards({ stats }: { stats: OrderStats }): JSX.Element
  // RevenueChart
  export default function RevenueChart({ data, granularity }: { data: RevenuePoint[]; granularity: 'day' | 'week' | 'month' }): JSX.Element
  // StatusSummary
  export default function StatusSummary({ counts }: { counts: Record<OrderStatus, number> }): JSX.Element
  // VercelAnalyticsLink
  export default function VercelAnalyticsLink(): JSX.Element
  ```

- [ ] **Step 1: Installer Recharts**

```bash
npm install recharts@^2.12
```

- [ ] **Step 2: Implémenter `PeriodSelector.tsx`** (Client Component — `'use client'`)

Props : `{ currentPeriod: string }`. Utilise `useRouter` de `next/navigation`.

4 boutons avec labels `['7j','30j','90j','12 mois']` et valeurs `['7d','30d','90d','12m']`. Au clic : `router.push('/admin/dashboard?period=<value>')`. Le bouton dont la valeur === `currentPeriod` porte une classe active différente (ex. `bg-stone-800 text-white` vs `bg-stone-100 text-stone-700`).

- [ ] **Step 3: Implémenter `StatsCards.tsx`** (Server Component — pas de `'use client'`)

Props : `{ stats: OrderStats }`.

Fonction interne `delta(current: number, prev: number): string` : si `prev === 0` retourner `'—'`, sinon `((current - prev) / prev * 100).toFixed(1) + '%'` préfixé `+` si positif.

3 cartes (div flex row, wrap sur mobile) affichant :
- "Chiffre d'affaires" / `formatPrice(stats.totalCents)` / delta CA
- "Commandes" / `stats.count` / delta count
- "Panier moyen" / `formatPrice(stats.avgCents)` / `—` si prev count = 0 sinon delta avg

Importer `formatPrice` depuis `@/lib/format`.

- [ ] **Step 4: Implémenter `RevenueChart.tsx`** (Client Component — `'use client'`)

Props : `{ data: RevenuePoint[]; granularity: 'day' | 'week' | 'month' }`.

Fonction `formatLabel(date: string, granularity: 'day'|'week'|'month'): string` :
- `'day'` → `date.substring(8,10) + '/' + date.substring(5,7)`
- `'week'` → `'Sem. ' + parseInt(date.substring(6))`
- `'month'` → `new Date(date + '-01').toLocaleDateString('fr-FR', { month: 'short' })`

Utiliser `ResponsiveContainer`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip` de `recharts`.
- `dataKey="totalCents"` sur `<Bar>`
- `tickFormatter` de `YAxis` : `(v: number) => formatPrice(v)`
- `formatter` du `Tooltip` : `(v: number) => [formatPrice(v), 'CA']`
- `tickFormatter` de `XAxis` : `(d: string) => formatLabel(d, granularity)`

- [ ] **Step 5: Implémenter `StatusSummary.tsx`** (Server Component)

Props : `{ counts: Record<OrderStatus, number> }`.

Map sur les 5 statuts dans l'ordre `['en_attente','confirmee','expediee','livree','echouee']` avec labels FR et couleurs de badge :
- `en_attente` → "En attente" / `bg-yellow-100 text-yellow-800`
- `confirmee` → "Confirmée" / `bg-blue-100 text-blue-800`
- `expediee` → "Expédiée" / `bg-orange-100 text-orange-800`
- `livree` → "Livrée" / `bg-green-100 text-green-800`
- `echouee` → "Échouée" / `bg-red-100 text-red-800`

- [ ] **Step 6: Implémenter `VercelAnalyticsLink.tsx`** (Server Component)

Bloc avec titre "Statistiques de visites", paragraphe d'explication, lien `<a href="https://vercel.com/analytics" target="_blank" rel="noopener noreferrer">`.

- [ ] **Step 7: Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 erreur nouvelle

- [ ] **Step 8: Vérifier les tests**

```bash
npx vitest run
```
Expected: tous les tests passent

- [ ] **Step 9: Commit**

```bash
git add components/admin/analytics/ package.json package-lock.json
git commit -m "feat: composants UI analytics — PeriodSelector, StatsCards, RevenueChart, StatusSummary, VercelAnalyticsLink"
```

---

### Task 3: Page dashboard + intégrations

**Files:**
- Create: `app/admin/dashboard/page.tsx`
- Create: `app/admin/dashboard/__tests__/page.test.tsx`
- Modify: `app/admin/layout.tsx` (ligne 31 — ajout lien Dashboard avant Commandes)
- Modify: `app/layout.tsx` (avant `</body>` — ajout `<Analytics />`)

**Interfaces:**
- Consumes (T1): `getOrderStats`, `getOrdersByStatus`, `getRevenueTimeSeries`, `OrderStats`, `RevenuePoint`
- Consumes (T2): `PeriodSelector`, `StatsCards`, `RevenueChart`, `StatusSummary`, `VercelAnalyticsLink`

- [ ] **Step 1: Installer @vercel/analytics**

```bash
npm install @vercel/analytics@^1
```

- [ ] **Step 2: Écrire les tests qui échouent**

```ts
// app/admin/dashboard/__tests__/page.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/data/analytics', () => ({
  getOrderStats: vi.fn().mockResolvedValue({
    totalCents: 15000,
    count: 3,
    avgCents: 5000,
    prevTotalCents: 10000,
    prevCount: 2,
  }),
  getOrdersByStatus: vi.fn().mockResolvedValue({
    en_attente: 1, confirmee: 2, expediee: 0, livree: 0, echouee: 0,
  }),
  getRevenueTimeSeries: vi.fn().mockResolvedValue([
    { date: '2026-10-01', totalCents: 5000 },
  ]),
}))

import DashboardPage from '../page'

describe('DashboardPage', () => {
  it('rend les 3 KPI cards avec les bonnes valeurs', async () => {
    const jsx = await DashboardPage({ searchParams: { period: '30d' } })
    render(jsx)
    expect(screen.getByText('Chiffre d\'affaires')).toBeInTheDocument()
    expect(screen.getByText('Commandes')).toBeInTheDocument()
    expect(screen.getByText('Panier moyen')).toBeInTheDocument()
  })

  it('utilise 30d par défaut si period invalide', async () => {
    const { getOrderStats } = await import('@/lib/data/analytics')
    await DashboardPage({ searchParams: { period: 'xyz' } })
    expect(getOrderStats).toHaveBeenCalled()
    const [from, to] = vi.mocked(getOrderStats).mock.calls.at(-1)!
    const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000)
    expect(diffDays).toBe(30)
  })
})
```

- [ ] **Step 3: Vérifier que les tests échouent**

```bash
npx vitest run app/admin/dashboard/__tests__/page.test.tsx
```
Expected: FAIL — `Cannot find module '../page'`

- [ ] **Step 4: Implémenter `app/admin/dashboard/page.tsx`**

Server Component. Signature : `export default async function DashboardPage({ searchParams }: { searchParams: { period?: string } })`.

Fonction helper interne `parsePeriod(p: string | undefined): { from: Date; to: Date; granularity: 'day' | 'week' | 'month' }` :
- Valeurs valides : `['7d','30d','90d','12m']` ; toute autre valeur → `'30d'`
- `to = new Date()` (maintenant)
- `from` :
  - `'7d'` → `new Date(to.getTime() - 7 * 86400000)`
  - `'30d'` → `new Date(to.getTime() - 30 * 86400000)`
  - `'90d'` → `new Date(to.getTime() - 90 * 86400000)`
  - `'12m'` → `new Date(to.getTime() - 365 * 86400000)`
- `granularity` : `'7d'`/`'30d'` → `'day'` ; `'90d'` → `'week'` ; `'12m'` → `'month'`

Corps de la page :
```ts
const { from, to, granularity } = parsePeriod(searchParams.period)
const [stats, statusCounts, series] = await Promise.all([
  getOrderStats(from, to),
  getOrdersByStatus(),
  getRevenueTimeSeries(from, to, granularity),
])
```

Layout JSX (Tailwind) :
```tsx
<div className="p-6 space-y-6">
  <h1>Dashboard</h1>
  <PeriodSelector currentPeriod={searchParams.period ?? '30d'} />
  <StatsCards stats={stats} />
  <RevenueChart data={series} granularity={granularity} />
  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
    <StatusSummary counts={statusCounts} />
    <VercelAnalyticsLink />
  </div>
</div>
```

- [ ] **Step 5: Ajouter le lien Dashboard dans `app/admin/layout.tsx`**

Insérer avant le lien Commandes (ligne 31) :
```tsx
<Link href="/admin/dashboard" className="text-stone-700 hover:text-stone-900">
  Dashboard
</Link>
```

- [ ] **Step 6: Ajouter `<Analytics />` dans `app/layout.tsx`**

Ajouter import et composant :
```tsx
import { Analytics } from '@vercel/analytics/next'
// dans le JSX, avant </body> :
<Analytics />
```

- [ ] **Step 7: Vérifier que les tests passent**

```bash
npx vitest run app/admin/dashboard/__tests__/page.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 8: Vérifier la suite complète**

```bash
npx vitest run
```
Expected: tous les tests passent

- [ ] **Step 9: Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 erreur nouvelle

- [ ] **Step 10: Commit**

```bash
git add app/admin/dashboard/ app/admin/layout.tsx app/layout.tsx package.json package-lock.json
git commit -m "feat: dashboard analytics — page, nav, Vercel Analytics"
```
