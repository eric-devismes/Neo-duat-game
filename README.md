# Home_Made — Gestion stock

Application web (PWA) pour le suivi des matériaux & consommables utilisés
pour la pose de terrasses sur plots.

- **Une référence par modèle d'article** (SKU + QR-code unique).
- **Scan QR** sur mobile pour enregistrer toute entrée (achat) ou sortie (chantier).
- **Valeur du stock** calculée automatiquement en CMUP (coût moyen unitaire pondéré)
  à chaque entrée, en fonction de la quantité achetée et du prix d'achat.
- **Export CSV** + **synchro Google Sheets** pour la compta.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + auto-API + auth) — gratuit
- Vercel pour l'hébergement — gratuit
- `html5-qrcode` (lecture QR), `qrcode` (génération QR), Google Sheets API

## Démarrer

Voir **[SETUP.md](./SETUP.md)** pour la mise en route pas-à-pas
(création projet Supabase, schéma SQL, déploiement Vercel, Google Sheets).

```bash
npm install
cp .env.local.example .env.local   # puis remplir les valeurs
npm run dev
```

## Structure

```
app/
  page.tsx                  Tableau de bord
  inventory/page.tsx        Liste du stock + filtres + valeur totale
  items/new/page.tsx        Créer une référence (SKU auto-généré)
  items/[id]/page.tsx       Détail article + saisie mouvement + historique
  scan/                     Scanner QR → IN/OUT
  labels/                   Page d'impression des étiquettes QR
  movements/page.tsx        Journal des mouvements
  api/
    export/items.csv        Téléchargement CSV des articles
    export/movements.csv    Téléchargement CSV des mouvements
    sheets/sync             POST: pousse vers Google Sheets
lib/
  supabase/                 Clients server / browser
  sheets.ts                 Sync Google Sheets via service account
  csv.ts                    Génération CSV (compatible Excel UTF-8)
  format.ts                 Formats EUR / quantités / dates (fr-FR)
  sku.ts                    Générateur de SKU "HM-XXXX-YYYY"
  types.ts                  Types TypeScript
supabase/
  schema.sql                Tables + trigger CMUP + vue
```

## Logique métier (CMUP)

À chaque entrée (kind = IN), le trigger Postgres recalcule:

```
nouveau_stock = stock + qté_entrée
nouveau_CMUP  = (stock × ancien_CMUP + qté_entrée × prix_achat) / nouveau_stock
valeur_stock  = nouveau_stock × nouveau_CMUP
```

À chaque sortie (kind = OUT), le stock diminue, le CMUP est conservé.

Le stock ne peut jamais devenir négatif (le trigger lève une erreur).
