import { isConfigured } from "@/lib/supabase/server";
import { createItem } from "@/app/items/actions";
import { UNITS, UNIT_LABEL } from "@/lib/types";
import ConfigGate from "@/components/ConfigGate";

export default function NewItemPage() {
  if (!isConfigured()) return <ConfigGate />;

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Nouvelle référence</h1>
      <form action={createItem} className="card space-y-3">
        <div>
          <label className="label">Nom *</label>
          <input
            name="name"
            required
            className="input"
            placeholder="ex: Plot réglable 40-60mm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">SKU (laisser vide = auto)</label>
            <input name="sku" className="input font-mono" placeholder="HM-XXXX-YYYY" />
          </div>
          <div>
            <label className="label">Unité *</label>
            <select name="unit" defaultValue="pcs" className="input">
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u} — {UNIT_LABEL[u]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Catégorie</label>
            <input
              name="category"
              className="input"
              placeholder="Plots / Lames / Visserie..."
            />
          </div>
          <div>
            <label className="label">Fournisseur</label>
            <input name="supplier" className="input" placeholder="ex: Jouplast" />
          </div>
        </div>
        <div>
          <label className="label">Stock minimum (alerte)</label>
          <input
            name="min_stock"
            type="number"
            step="0.001"
            min="0"
            defaultValue={0}
            className="input"
          />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea name="notes" rows={3} className="input" />
        </div>
        <div className="flex justify-end gap-2">
          <a href="/inventory" className="btn-secondary">
            Annuler
          </a>
          <button className="btn-primary">Créer</button>
        </div>
      </form>
    </div>
  );
}
