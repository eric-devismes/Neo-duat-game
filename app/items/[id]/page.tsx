import Link from "next/link";
import { notFound } from "next/navigation";
import { isConfigured, getSupabaseAdmin } from "@/lib/supabase/server";
import { formatEUR, formatQty, formatDate } from "@/lib/format";
import { UNITS, UNIT_LABEL } from "@/lib/types";
import {
  recordMovement,
  restoreMovement,
  updateItem,
  voidMovement,
} from "@/app/items/actions";
import ConfigGate from "@/components/ConfigGate";

export const dynamic = "force-dynamic";

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  if (!isConfigured()) return <ConfigGate />;
  const { id } = await params;
  const sp = await searchParams;

  const sb = getSupabaseAdmin();
  const { data: item } = await sb.from("items").select("*").eq("id", id).single();
  if (!item) return notFound();

  const { data: moves } = await sb
    .from("movements")
    .select("*")
    .eq("item_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: chantiers } = await sb
    .from("chantiers")
    .select("id, name")
    .eq("status", "actif")
    .order("name");

  const updateThis = updateItem.bind(null, id);

  return (
    <div className="space-y-6">
      {sp.created && (
        <div className="card bg-green-50 border-green-200 text-green-900">
          Référence créée. Imprimez son étiquette via{" "}
          <Link href={`/labels?ids=${item.id}`} className="underline font-medium">
            Étiquettes
          </Link>
          .
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{item.name}</h1>
          <p className="text-sm text-brand-700 font-mono">{item.sku}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/labels?ids=${item.id}`} className="btn-secondary text-sm">
            Étiquette QR
          </Link>
          <Link href="/scan" className="btn-primary text-sm">
            Scanner
          </Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-xs uppercase text-brand-500">Stock</div>
          <div className="text-2xl font-semibold mt-1">
            {formatQty(item.quantity)}{" "}
            <span className="text-base font-normal">{item.unit}</span>
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-brand-500">CMUP</div>
          <div className="text-2xl font-semibold mt-1">
            {formatEUR(item.avg_unit_cost)}
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-brand-500">Valeur stock</div>
          <div className="text-2xl font-semibold mt-1">
            {formatEUR(item.total_value)}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form action={recordMovement} className="card space-y-3">
          <input type="hidden" name="item_id" value={item.id} />
          <h2 className="font-semibold">Enregistrer un mouvement</h2>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-brand-100 bg-brand-50 px-3 py-2">
              <input type="radio" name="kind" value="IN" defaultChecked />
              <span className="font-medium text-green-700">+ Entrée (achat)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-brand-100 bg-brand-50 px-3 py-2">
              <input type="radio" name="kind" value="OUT" />
              <span className="font-medium text-red-700">− Sortie (chantier)</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Quantité ({item.unit})</label>
              <input
                name="quantity"
                type="number"
                step="0.001"
                min="0.001"
                required
                className="input"
              />
            </div>
            <div>
              <label className="label">Prix unitaire HT (entrée)</label>
              <input
                name="unit_cost"
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="EUR"
              />
            </div>
          </div>
          <div>
            <label className="label">Chantier (sortie)</label>
            <select name="chantier_id" defaultValue="" className="input">
              <option value="">— Aucun (saisie libre ci-dessous) —</option>
              {chantiers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              name="site"
              className="input mt-2"
              placeholder="Ou saisie libre: ex Terrasse Dupont"
            />
          </div>
          <div>
            <label className="label">Note</label>
            <input name="note" className="input" />
          </div>
          <button className="btn-primary w-full">Valider le mouvement</button>
        </form>

        <form action={updateThis} className="card space-y-3">
          <h2 className="font-semibold">Modifier la référence</h2>
          <div>
            <label className="label">Nom</label>
            <input
              name="name"
              defaultValue={item.name}
              required
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Catégorie</label>
              <input
                name="category"
                defaultValue={item.category ?? ""}
                className="input"
              />
            </div>
            <div>
              <label className="label">Unité</label>
              <select name="unit" defaultValue={item.unit} className="input">
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u} — {UNIT_LABEL[u]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Fournisseur</label>
              <input
                name="supplier"
                defaultValue={item.supplier ?? ""}
                className="input"
              />
            </div>
            <div>
              <label className="label">Stock min.</label>
              <input
                name="min_stock"
                type="number"
                step="0.001"
                min="0"
                defaultValue={item.min_stock}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              name="notes"
              defaultValue={item.notes ?? ""}
              rows={2}
              className="input"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="archived"
              defaultChecked={item.archived}
            />
            Archiver cette référence
          </label>
          <button className="btn-secondary w-full">Enregistrer</button>
        </form>
      </section>

      <section className="card overflow-x-auto p-0">
        <h2 className="font-semibold p-4 pb-2">Historique des mouvements</h2>
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-brand-700">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-right px-3 py-2">Qté</th>
              <th className="text-right px-3 py-2">PU</th>
              <th className="text-left px-3 py-2">Chantier</th>
              <th className="text-left px-3 py-2">Note</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {moves?.length ? (
              moves.map((m) => {
                const voided = !!m.voided_at;
                return (
                  <tr
                    key={m.id}
                    className={`border-t border-brand-100 ${
                      voided ? "line-through text-brand-500 bg-brand-50/50" : ""
                    }`}
                  >
                    <td className="px-3 py-2">{formatDate(m.created_at)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          m.kind === "IN" ? "text-green-700" : "text-red-700"
                        }
                      >
                        {m.kind === "IN" ? "Entrée" : "Sortie"}
                      </span>
                      {voided && " (annulé)"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.kind === "IN" ? "+" : "−"}
                      {formatQty(m.quantity)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.unit_cost != null ? formatEUR(m.unit_cost) : "—"}
                    </td>
                    <td className="px-3 py-2">{m.site ?? "—"}</td>
                    <td className="px-3 py-2">{m.note ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {voided ? (
                        <form action={restoreMovement} className="inline">
                          <input type="hidden" name="id" value={m.id} />
                          <button className="text-xs text-brand-700 hover:underline">
                            Restaurer
                          </button>
                        </form>
                      ) : (
                        <form action={voidMovement} className="inline">
                          <input type="hidden" name="id" value={m.id} />
                          <button
                            className="text-xs text-red-700 hover:underline"
                            title="Annuler ce mouvement (recalcule le stock)"
                          >
                            Annuler
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-brand-500" colSpan={7}>
                  Aucun mouvement
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
