# Auguste Woodworking — Design Spec

**Date :** 2026-10-25  
**Auteur :** Basile Dufloux (via session Claude)  
**Stack :** Next.js 14 (App Router) + Supabase + Stripe + Vercel

---

## 1. Vision et objectifs

Site vitrine + boutique e-commerce pour Auguste, artisan menuisier. Les clients peuvent découvrir son travail, parcourir ses créations, et passer commande directement en ligne. Auguste gère son catalogue et ses commandes depuis une interface admin.

**Succès :** un client arrive sur le site, est convaincu par les photos et le ton artisanal, commande un objet, paie en ligne, et reçoit un email de confirmation. Auguste voit la commande dans son admin et expédie.

---

## 2. Pages publiques

### 2.1 Accueil (`/`)

- **Hero** : grande photo plein-écran d'une pièce emblématique + nom "Auguste Woodworking" + sous-titre court (ex : "Objets en bois faits à la main") + 2 CTA : "Voir la boutique" / "Découvrir l'atelier"
- **Section boutique** : grille de 3–4 produits vedettes avec photo, nom, prix + lien "Voir tous les produits"
- **Section réalisations** : 3 photos de projets sur-mesure non commerciaux (preuve de savoir-faire), lien vers galerie
- **À propos court** : 2–3 phrases sur Auguste + photo de l'atelier, lien vers la page À propos
- **Footer** : liens nav, mentions légales, CGV, politique de confidentialité, email de contact

### 2.2 Boutique (`/boutique`)

- Grille de produits (photo, nom, prix, disponibilité)
- Filtre par catégorie (optionnel à V1, flag en base)
- Clic sur un produit → page produit

### 2.3 Page produit (`/boutique/[slug]`)

- Carrousel de photos
- Nom, description, prix, dimensions/matériaux
- Bouton "Ajouter au panier" (désactivé si stock = 0)
- Note sur la fabrication artisanale / délais si applicable

### 2.4 Panier (`/panier`)

- Liste des produits, quantités (limitées au stock dispo), sous-total
- Frais de livraison affichés : somme des `shipping_price_cents` de chaque ligne
- Bouton "Passer commande" → checkout
- **Stockage :** `localStorage` uniquement (V1) — pas de sync serveur

### 2.5 Checkout (`/checkout`)

- **Étape 1 — Coordonnées** : nom, email, téléphone
  - Option : "Créer un compte" (checkbox, optionnelle)
- **Étape 2 — Livraison** : adresse de livraison complète
- **Étape 3 — Paiement** : Stripe Elements (carte bancaire)
  - En cas d'échec Stripe : message d'erreur affiché sous le formulaire, le client reste sur l'étape paiement et peut réessayer
- Récapitulatif de commande visible à droite (desktop) / en bas (mobile)
- Pas de click & collect — livraison uniquement

### 2.6 Confirmation de commande (`/commande/confirmation`)

- Numéro de commande (format `AW-AAAA-NNNNN`, ex : `AW-2026-00001`), récapitulatif, adresse de livraison
- Email de confirmation envoyé automatiquement via **Resend** (déclenché par le webhook Stripe)

### 2.7 À propos (`/atelier`)

- Histoire d'Auguste, sa démarche, ses matériaux
- Photos de l'atelier
- CTA vers la boutique

### 2.8 Réalisations (`/realisations`)

- Galerie de projets sur-mesure (non achetables)
- Chaque réalisation : photos + description courte

### 2.9 Contact (`/contact`)

- Formulaire simple (nom, email, message)
- Email envoyé à Auguste

### 2.10 Pages légales

- `/mentions-legales`
- `/cgv`
- `/politique-de-confidentialite`

---

## 3. Espace client (optionnel, compte)

Si le client crée un compte :
- `/compte` — tableau de bord : historique de commandes
- `/compte/commandes/[id]` — détail d'une commande + statut
- Auth via Supabase Auth (email/password)

Les commandes passées en invité sont liées à l'email uniquement.

---

## 4. Interface admin (`/admin`)

Accessible uniquement à Auguste via `/admin/login` (email + password). Compte admin créé manuellement une fois en production via le dashboard Supabase. Rôle `admin` assigné via `user_metadata` ou une table `profiles` côté Supabase.

### 4.1 Dashboard

- Nombre de commandes en attente
- Chiffre d'affaires du mois
- Raccourcis vers les sections principales

### 4.2 Produits (`/admin/produits`)

- Liste de tous les produits (nom, prix, stock, statut publié/caché)
- Créer un produit : nom, slug, description, prix, stock, catégorie, photos (upload), publié, frais de livraison, commandable hors-stock
- Modifier / supprimer un produit

### 4.3 Commandes (`/admin/commandes`)

- Liste des commandes (numéro, date, client, montant, statut)
- Statuts : `en_attente` → `confirmée` → `expédiée` → `livrée`
- Vue détail : produits commandés, adresse de livraison, infos client
- Changer le statut manuellement
- (V2 : numéro de suivi, email automatique au client sur expédition)

### 4.4 Réalisations (`/admin/realisations`)

- Gérer les photos de la galerie "Réalisations" (pas de prix, juste photos + description)

---

## 5. Modèle de données (Supabase / PostgreSQL)

```
products
  id, slug, name, description, price_cents, stock, shipping_price_cents, allow_preorder, category, published, created_at
  → photos: product_photos (id, product_id, url, position)
  
  Notes :
  - shipping_price_cents : frais de livraison fixés par Auguste produit par produit
  - allow_preorder : si true, commandable même à stock = 0

orders
  id, order_number, status, email, phone, created_at, stripe_payment_intent_id
  → customer_id (nullable, lié à auth.users)
  → order_items (id, order_id, product_id, quantity, unit_price_cents)

shipping_addresses
  id, order_id, first_name, last_name, line1, line2, city, postal_code, country

realisations
  id, title, description, created_at
  → realisation_photos (id, realisation_id, url, position)
```

Auth : Supabase Auth avec rôles — `customer` (optionnel) et `admin` (Auguste).

---

## 6. Intégration Stripe

- **Payment Intents** : créé côté serveur (Next.js API Route / Server Action) au moment du checkout
- **Stripe Elements** : formulaire carte côté client
- **Webhook** `payment_intent.succeeded` : confirme la commande en base, **décrémente le stock**, envoie l'email de confirmation via Resend
- **Webhook** `payment_intent.payment_failed` : marque la commande comme `echouee` en base
- Pas de Stripe Connect (Auguste = seul vendeur)
- Devise : EUR

---

## 7. Design et identité visuelle

**Références :** Arnault Janvier Vitrail (structure, sobriété, photos en vedette)

**Principes :**
- La photographie fait le travail — espaces généreux, peu de texte
- Typographie : une serif élégante pour les titres (ex : Playfair Display ou Cormorant Garamond), une sans-serif lisible pour le corps (ex : Inter)
- Palette : tons chauds et naturels (crème, brun, bois) + blanc cassé pour le fond
- Sections rythmées par de petites étiquettes (ex : "Boutique", "Atelier", "Réalisations")
- Mobile-first — le checkout en particulier doit être fluide sur téléphone

---

## 8. Infrastructure et déploiement

- **Frontend :** Next.js 14 App Router, hébergé sur Vercel
- **Base de données + Auth + Storage :** Supabase (photos produits stockées dans Supabase Storage)
- **Paiement :** Stripe
- **Emails transactionnels :** Resend (SDK Node.js, appelé depuis les API Routes Next.js au moment du webhook Stripe)
- **Domaine :** à définir (ex : auguste-woodworking.fr)
- Variables d'env : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`

---

## 9. Ce qui est hors scope (V1)

- Produits configurables (ex : choix d'essence de bois, dimensions sur-mesure)
- Codes promo / réductions
- Avis clients / notes
- Fil Instagram embarqué
- Multi-langue
- Click & collect

Ces éléments peuvent être ajoutés en V2.

---

## 10. Décisions arrêtées

- **Frais de livraison multi-produits :** somme des `shipping_price_cents` de chaque ligne du panier
- **Décrémentation du stock :** au webhook Stripe `payment_intent.succeeded` uniquement
- **Accès admin :** URL directe `/admin/login`, compte Auguste créé manuellement en production
- **Erreur paiement :** message d'erreur inline sous le formulaire Stripe, pas de redirection
- **Panier :** `localStorage` uniquement en V1
- **Numéro de commande :** format `AW-AAAA-NNNNN`
- **Email transactionnel :** Resend

## 11. Questions ouvertes

- **Nom de domaine :** déjà acheté ou à acheter ?
- **Contenu réel :** textes "À propos", photos produits, photos atelier — à fournir par Auguste avant mise en production (on développe avec du contenu placeholder)
