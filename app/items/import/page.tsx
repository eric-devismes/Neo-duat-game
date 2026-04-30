import Link from "next/link";
import { isConfigured } from "@/lib/supabase/server";
import ConfigGate from "@/components/ConfigGate";
import ImportClient from "./ImportClient";

export default function ImportItemsPage() {
  if (!isConfigured()) return <ConfigGate />;
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Import en masse — articles</h1>
        <Link href="/inventory" className="btn-secondary text-sm">
          ← Stock
        </Link>
      </div>

      <div className="card text-sm space-y-2">
        <p>
          Collez ci-dessous un export CSV ou TSV (Excel / Google Sheets, séparateur
          virgule, point-virgule ou tabulation accepté). Premier ligne = en-têtes.
        </p>
        <p>
          <strong>Colonne obligatoire</strong>: <code>nom</code> (ou{" "}
          <code>name</code>).
        </p>
        <p>
          <strong>Colonnes reconnues</strong>:{" "}
          <code>sku</code>, <code>nom</code>, <code>catégorie</code>,{" "}
          <code>unité</code> (pcs, m, m2, ml, kg, L, sac, boite),{" "}
          <code>fournisseur</code>, <code>stock min</code>, <code>notes</code>.
        </p>
        <p className="text-brand-700">
          Si <code>sku</code> est vide, un SKU est généré automatiquement.
        </p>
      </div>

      <ImportClient />
    </div>
  );
}
