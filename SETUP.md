# Mise en route — Home_Made stock

Ce document est conçu pour que vous puissiez reprendre le projet en autonomie
à votre retour. Toutes les étapes sont gratuites (free tier).

---

## 0. Pré-requis

- Node.js 20+ (https://nodejs.org)
- Un compte GitHub (déjà OK)
- Un compte Supabase: https://supabase.com (gratuit)
- Un compte Vercel: https://vercel.com (gratuit, peut s'inscrire avec GitHub)
- (Optionnel) Un compte Google Cloud pour la synchro Sheets

---

## 1. Cloner et installer

```bash
git clone <url-du-repo>
cd Neo-duat-game
git checkout claude/asset-consumable-management-jwdEp
npm install
```

---

## 2. Créer le projet Supabase (5 min)

1. Aller sur https://supabase.com → **New project**.
2. Choisir un nom (ex: `home-made-stock`), une région **Europe (Paris ou Frankfurt)**,
   un mot de passe DB (à conserver).
3. Attendre ~1 min que le projet soit provisionné.
4. Dans le menu de gauche: **SQL Editor** → **New query**.
5. Copier-coller le contenu de `supabase/schema.sql` puis **Run**.
   Vous devriez voir `Success. No rows returned`. Cela crée:
   - la table `items` (1 ligne par référence d'article)
   - la table `movements` (1 ligne par entrée/sortie)
   - le trigger `apply_movement` qui recalcule stock + CMUP automatiquement
   - la vue `items_view` (utile pour la sortie tableur)
6. Menu **Settings → API**, copier:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ secret côté serveur)

---

## 3. Configurer `.env.local`

```bash
cp .env.local.example .env.local
```

Remplir les 3 variables Supabase ci-dessus. `NEXT_PUBLIC_APP_URL` peut rester
`http://localhost:3000` en local.

---

## 4. Lancer en local

```bash
npm run dev
```

→ http://localhost:3000

Premier essai recommandé:
1. **Stock → + Référence** : créer un article ("Plot réglable 40-60mm", unité `pcs`).
2. Sur la page de l'article, **Étiquette QR** → ouvrir, imprimer ou afficher
   sur un autre écran.
3. Sur mobile (même Wi-Fi, ou après déploiement Vercel), aller sur **Scanner**,
   scanner l'étiquette → choisir **Entrée**, qté `100`, prix `4.95` → Valider.
4. Refaire un scan: **Sortie**, qté `12`, chantier `Test`. Vérifier que le
   stock et la valeur s'ajustent correctement.

---

## 5. Déployer sur Vercel

1. Pousser votre branche `claude/asset-consumable-management-jwdEp` sur GitHub
   (déjà fait par Claude).
2. Sur https://vercel.com → **Add new project** → importer le repo.
3. Framework détecté automatiquement (Next.js).
4. **Environment Variables**: ajouter les 3 variables Supabase + `NEXT_PUBLIC_APP_URL`
   (qui sera l'URL Vercel finale, ex: `https://home-made-stock.vercel.app`).
5. **Deploy**.

L'app est désormais accessible depuis n'importe quel navigateur (PC, mobile).
Sur iPhone/Android, "Ajouter à l'écran d'accueil" pour un comportement type appli.

⚠️ Le scan QR exige **HTTPS** (sauf localhost). Vercel fournit HTTPS d'office.

---

## 6. (Optionnel) Synchronisation Google Sheets

Pour pousser vos articles + mouvements dans une feuille Sheets que la
compta peut consulter / annoter:

### a. Créer le service account

1. https://console.cloud.google.com → créer un projet (`home-made-stock`).
2. **APIs & Services → Library** → activer **Google Sheets API**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   - Nom: `home-made-stock-sync`. Pas besoin de rôle particulier.
4. Sur le service account créé: onglet **Keys → Add key → JSON**.
   Un fichier JSON se télécharge. Garder précieusement.

### b. Créer la feuille Google Sheets

1. https://sheets.google.com → nouvelle feuille (ex: `Home_Made — Stock`).
2. **Renommer** les onglets nécessaires:
   - Onglet 1 → `Articles`
   - Onglet 2 (clic + en bas à gauche) → `Mouvements`
3. Récupérer l'**ID de la feuille** dans l'URL:
   `docs.google.com/spreadsheets/d/`**`<ID>`**`/edit`.
4. **Partager** la feuille avec l'email du service account (trouvé dans
   `client_email` du JSON, finit par `@...iam.gserviceaccount.com`),
   en lui donnant le rôle **Éditeur**.

### c. Configurer l'app

Dans `.env.local` (et dans Vercel) :

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=home-made-stock-sync@...iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=<ID-de-la-feuille>
```

⚠️ La clé privée contient des `\n` littéraux (le code les convertit en vraies
nouvelles lignes). Sur Vercel, coller la valeur **avec** les `\n` littéraux.

### d. Tester

- En local: ouvrir http://localhost:3000/api/sheets/sync — réponse JSON
  `{ "ok": true, "items": ..., "movements": ... }`.
- Depuis l'UI: **Stock → Sync Google Sheets**.

À chaque appel, les onglets `Articles` et `Mouvements` sont **réécrits** avec
l'état complet à l'instant T. Vous pouvez ajouter d'autres onglets de calcul
qui pointent vers ces données — ils ne seront pas écrasés.

---

## 7. Comment ça marche (vue d'ensemble)

| Page | Pour qui | Ce qu'on y fait |
|---|---|---|
| `/` | tous | Tableau de bord (valeur stock, alertes stock bas, derniers mouvements) |
| `/inventory` | bureau | Voir tout le stock, filtrer, exporter CSV/Sheets |
| `/items/new` | bureau | Créer une nouvelle référence → SKU auto + QR |
| `/items/<id>` | tous | Voir un article, saisir un mouvement à la main, historique |
| `/scan` | mobile (chantier/atelier) | Scanner un QR → IN ou OUT en 3 clics |
| `/labels` | bureau | Imprimer une planche d'étiquettes A4 |
| `/movements` | compta | Journal complet, filtrable, export CSV |

### Workflow type

- **Achat de matériel**: livraison reçue → on scanne chaque référence,
  on saisit la quantité achetée et le prix unitaire HT figurant sur la facture.
  Le stock augmente, le CMUP est recalculé en pondérant.
- **Départ pour chantier**: on scanne, on choisit *Sortie*, on tape la quantité
  et éventuellement le nom du chantier. Le stock diminue, la valeur baisse de
  `qté × CMUP`.
- **Compta mensuelle**: clic sur *Sync Google Sheets* (ou export CSV) → la
  feuille se met à jour, la compta y voit la valeur totale et le détail.

---

## 8. Pour aller plus loin (idées v2)

- **Auth Supabase**: ajouter un login email magic-link (multi-utilisateur).
- **Coût par chantier**: agréger les sorties par `site` pour produire un
  rapport de coût matières par chantier.
- **Photos**: ajouter une photo par article (Supabase Storage).
- **Code-barres**: certains fournisseurs livrent déjà avec EAN-13 — la lib
  `html5-qrcode` lit aussi les codes-barres, il suffit d'autoriser ces formats.
- **Hors ligne**: PWA + cache → enregistrer les scans sans réseau et synchro
  au retour Wi-Fi.

---

## 9. En cas de doute

- Toutes les pages affichent un écran "Configuration Supabase requise" tant que
  les variables d'environnement ne sont pas posées — pas de crash.
- Le schéma SQL est ré-exécutable (`create table if not exists`, `create or
  replace function`...). Vous pouvez le ré-appliquer sans risque sur un
  projet vide.
- Le trigger Postgres garantit la cohérence stock/valeur **côté base** :
  même un appel direct via l'API Supabase ne peut pas désynchroniser les
  totaux.
