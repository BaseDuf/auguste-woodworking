# Auguste Woodworking — Plan 3 : Panier & Checkout

**Date :** 2026-10-26
**Auteur :** Basile Dufloux (via session Claude)
**Branche de base :** `claude/keen-clarke-6b4ggw` (stacké sur Plan 2)

---

## 1. Objectif

Permettre à un visiteur d'ajouter des produits à son panier, de passer commande, de payer par carte via Stripe, et de recevoir un email de confirmation. L'artisan voit la commande créée en base (prête pour Plan 4 : admin).

**Succès :** un client parcourt la boutique, ajoute un produit, complète les 3 étapes du checkout, paie, et atterrit sur une page de confirmation avec son numéro de commande. Le stock est décrémenté. Un email part via Resend (stub si clé absente).

---

## 2. Migrations base de données

### 2.1 Nouvelles tables

```sql
-- orders
CREATE TABLE orders (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number            TEXT UNIQUE NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'en_attente'
                            CHECK (status IN ('en_attente','confirmee','expediee','livree','echouee')),
  email                   TEXT NOT NULL,
  phone                   TEXT,
  customer_id             UUID REFERENCES auth.users(id),
  stripe_payment_intent_id TEXT,
  total_cents             INTEGER NOT NULL,
  shipping_cents          INTEGER NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- order_items
CREATE TABLE order_items (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id            UUID NOT NULL REFERENCES products(id),
  quantity              INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents      INTEGER NOT NULL,
  shipping_price_cents  INTEGER NOT NULL
);

-- shipping_addresses
CREATE TABLE shipping_addresses (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  line1       TEXT NOT NULL,
  line2       TEXT,
  city        TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country     TEXT NOT NULL DEFAULT 'FR'
);
```

### 2.2 Fonction de génération du numéro de commande

```sql
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  year_part TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
  seq_num   INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 9) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM orders
  WHERE order_number LIKE 'AW-' || year_part || '-%';
  RETURN 'AW-' || year_part || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$;
```

Format : `AW-2026-00001`.

### 2.3 RLS

- `orders` : INSERT autorisé pour tout le monde (invités inclus) ; SELECT limité à `auth.uid() = customer_id` pour les authentifiés ; service role bypass total.
- `order_items`, `shipping_addresses` : accès en lecture via la relation `order_id` → même logique via service role pour le webhook.
- Le webhook utilise exclusivement la clé service role (bypass RLS).

---

## 3. Cart (localStorage + React Context)

### 3.1 Types

```ts
// lib/cart/types.ts
export type CartItem = {
  productId: string
  slug: string
  name: string
  price_cents: number
  shipping_price_cents: number
  stock: number
  allow_preorder: boolean
  photo_url: string | null
  quantity: number
}
```

### 3.2 Hook useCart

```ts
// lib/cart/use-cart.ts
{
  items: CartItem[]
  addItem(product: ProductWithPhotos): void
    // +1 si déjà présent
    // max = stock si !allow_preorder, illimité sinon
  removeItem(productId: string): void
  updateQty(productId: string, qty: number): void
    // qty ≤ 0 → removeItem
  clearCart(): void
  totalItems: number           // somme des quantités
  subtotalCents: number        // Σ price_cents × qty
  shippingCents: number        // Σ shipping_price_cents × qty
  grandTotalCents: number      // subtotal + shipping
}
```

**Persistance :** clé localStorage `"aw_cart"`. Lecture au mount (`useEffect`), écriture à chaque changement d'`items`. Pas de sync serveur.

### 3.3 CartContext

`lib/cart/cart-context.tsx` — Provider wrappé dans `app/layout.tsx` (client boundary via `'use client'` sur le Provider uniquement).

---

## 4. Composants

### 4.1 CartIcon (Nav)

`components/cart-icon.tsx` — icône panier avec badge rouge `totalItems`. Affiché seulement si `totalItems > 0`. Lien vers `/panier`. Intégré dans `components/nav.tsx`.

### 4.2 AddToCartButton (mise à jour)

`components/add-to-cart-button.tsx` — câblé sur `useCart().addItem()`. Feedback visuel "Ajouté ✓" pendant 1 s après ajout. États existants conservés (rupture, précommande).

---

## 5. Pages

### 5.1 `/panier`

Composant client. Affiche :
- Liste des lignes : photo (50×50), nom, prix unitaire, frais de livraison ligne, sélecteur quantité (+/−), bouton supprimer
- Récapitulatif : sous-total produits, total frais de livraison, **total TTC** (en gras)
- CTA "Passer commande" → `/checkout`
- État vide : message + lien `/boutique`

Prix formatés en `fr-FR` EUR (règle du déféré M2 de Plan 2, appliquée ici).

### 5.2 `/checkout`

Page client unique. État React local : `step` (1 | 2 | 3), `coordonnees`, `livraison`. Pas de persistance entre navigations (refresh = retour étape 1).

**Étape 1 — Coordonnées**
- Champs : prénom, nom, email, téléphone
- Checkbox "Créer un compte" : présente, désactivée, label "Bientôt disponible"
- Bouton "Continuer"

**Étape 2 — Livraison**
- Champs : adresse ligne 1, ligne 2 (optionnel), ville, code postal, pays (select, défaut FR)
- Bouton "Retour" (étape 1) + "Continuer"

**Étape 3 — Paiement**
- Au montage : appel Server Action `createPaymentIntent()` → PI Stripe créé + ordre en base → `clientSecret` retourné
- Stripe Elements monté avec `clientSecret`
- `stripe.confirmPayment({ return_url: '<origin>/commande/confirmation' })`
- Erreur Stripe : message inline sous le formulaire, pas de redirection
- Bouton "Retour" désactivé une fois le PI créé (on ne recrée pas)
- Spinner pendant la création du PI

**Récap commande** (visible à droite ≥ md, collapsible en haut sur mobile) : lignes produits, sous-total, frais de livraison, total TTC — présent sur les 3 étapes.

### 5.3 `/commande/confirmation`

Stripe redirige vers `return_url` avec `?payment_intent_client_secret=pi_xxx_secret_xxx`.

La page :
1. Extrait `payment_intent` depuis les params
2. Récupère l'ordre en base via `stripe_payment_intent_id` (service role)
3. Affiche : numéro de commande, liste des produits commandés, adresse de livraison, email de contact
4. Message : "Un email de confirmation vous a été envoyé à {email}"
5. Si ordre non trouvé (webhook pas encore passé) : polling léger (3 tentatives × 1 s) puis affichage dégradé "Votre commande est en cours de traitement — numéro : {PI id}"

---

## 6. Server Action : createPaymentIntent

`app/checkout/actions.ts` — Server Action `'use server'`.

**Entrée :**
```ts
{
  items: { productId: string; quantity: number }[]
  email: string
  phone?: string
  firstName: string
  lastName: string
  address: { line1: string; line2?: string; city: string; postalCode: string; country: string }
}
```

**Logique :**
1. Recharge les produits depuis Supabase (ne pas faire confiance aux prix du client)
2. Calcule `total_cents` et `shipping_cents` côté serveur
3. Vérifie la disponibilité (stock > 0 ou `allow_preorder`)
4. Crée le Payment Intent Stripe (`amount: grandTotalCents, currency: 'eur'`)
5. Crée l'ordre en base (statut `en_attente`) + `order_items` + `shipping_addresses`
6. Retourne `{ clientSecret, orderId }`

**Erreurs :**
- Stock insuffisant → erreur métier renvoyée au client
- Erreur Stripe → erreur générique

---

## 7. Webhook Stripe

`app/api/webhooks/stripe/route.ts` — route POST, pas de middleware CSRF.

**Sécurité :** vérification de la signature via `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)` — body lu en `Buffer` brut (pas de `json()`). Réponse 400 si invalide.

**`payment_intent.succeeded` :**
1. Récupère l'ordre par `stripe_payment_intent_id`
2. Met le statut à `confirmee`
3. Pour chaque `order_item` : `UPDATE products SET stock = stock - quantity WHERE id = product_id`
4. Appelle `sendOrderConfirmation(order)`
5. Répond 200

**`payment_intent.payment_failed` :**
1. Met le statut à `echouee`
2. Répond 200

**Autres events :** répond 200 silencieusement.

---

## 8. Email : sendOrderConfirmation

`lib/email/send-order-confirmation.ts`

```ts
export async function sendOrderConfirmation(order: OrderWithItems): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('[email] RESEND_API_KEY absent — confirmation non envoyée', order.order_number)
    return
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Auguste Woodworking <commandes@auguste-woodworking.fr>',
      to: order.email,
      subject: `Confirmation de commande ${order.order_number}`,
      // Template texte simple : numéro, lignes produits, total, adresse
    })
  } catch (err) {
    console.error('[email] Erreur envoi confirmation', err)
    // Ne pas propager — le webhook doit répondre 200
  }
}
```

---

## 9. Variables d'environnement

```
STRIPE_SECRET_KEY                     # clé secrète Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY    # clé publique Stripe
STRIPE_WEBHOOK_SECRET                 # secret webhook Stripe (stripe listen en dev)
RESEND_API_KEY                        # optionnel en dev — stub si absent
```

---

## 10. Décisions arrêtées

- **Panier :** localStorage uniquement, clé `"aw_cart"`, pas de sync serveur
- **Prix côté serveur :** `createPaymentIntent` recharge les prix depuis Supabase (sécurité)
- **PI créé à l'étape 3 :** pas au chargement du checkout (évite les PI abandonnés)
- **Stock décrémenté :** uniquement au webhook `payment_intent.succeeded`
- **Erreur paiement :** inline sous Stripe Elements, pas de redirection
- **Compte client :** checkbox UI présente mais désactivée, fonctionnel en Plan 5
- **Email :** Resend, try/catch complet — absence de clé = log + continue
- **Prix formatés :** `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })` (déféré M2 de Plan 2 appliqué ici)
- **Confirmation :** polling léger (3 × 1 s) si webhook pas encore passé

---

## 11. Hors scope Plan 3

- Espace client (compte, historique de commandes) → Plan 5
- Interface admin commandes → Plan 4
- Numéro de suivi, email d'expédition → Plan 4/V2
- Codes promo → hors scope V1
