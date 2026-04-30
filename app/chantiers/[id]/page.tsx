import Link from "next/link";
import { notFound } from "next/navigation";
import { isConfigured, getSupabaseAdmin } from "@/lib/supabase/server";
import { formatEUR, formatQty, formatDate } from "@/lib/format";
import { CHANTIER_STATUSES, CHANTIER_STATUS_LABEL } from "@/lib/types";
import { updateChantier } from "@/app/chantiers/actions";
import ConfigGate from "@/components/ConfigGate";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function ChantierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isConfigured()) return <ConfigGate />;
  const { id } = await params;

  const sb = getSupabaseAdmin();
  const { data: chantier } = await sb
    .from("chantiers")
    .select("*")
    .eq("id", id)
    .single();
  if (!chantier) return notFound();

  const { data: moves } = await sb
    .from("movements")
    .select("id, quantity, cost_at_movement, created_at, note, item:items(id, sku, name, unit)")
    .eq("chantier_id", id)
    .eq("kind", "OUT")
    .is("voided_at", null)
    .order("created_at", { ascending: false });

  type Row = NonNullable<typeof moves>[number];
  type Agg = {
    item: Row["item"];
    qty: number;
    avg_cost: number;
    total: number;
  };
  const grouped = new Map<string, Agg>();
  let grandTotal = 0;
  for (const m of moves ?? []) {
    const itemId = (m.item as any)?.id ?? "?";
    const cost = Number(m.cost_at_movement ?? 0) * Number(m.quantity);
    grandTotal += cost;
    const existing = grouped.get(itemId);
    if (existing) {
      existing.qty += Number(m.quantity);
      existing.total += cost;
      existing.avg_cost = existing.qty ? existing.total / existing.qty : 0;
    } else {
      grouped.set(itemId, {
        item: m.item,
        qty: Number(m.quantity),
        avg_cost: Number(m.cost_at_movement ?? 0),
        total: cost,
      });
    }
  }
  const aggregated = Array.from(grouped.values()).sort((a, b) => b.total - a.total);

  const updateThis = updateChantier.bind(null, id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{chantier.name}</h1>
          <p className="text-sm text-brand-700">
            {chantier.client ?? "—"}
            {chantier.address ? ` · ${chantier.address}` : ""}
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <PrintButton />
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-xs uppercase text-brand-500">Coût matière</div>
          <div className="text-2xl font-semibold mt-1">
            {formatEUR(grandTotal)}
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-brand-500">Articles</div>
          <div className="text-2xl font-semibold mt-1">{aggregated.length}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-brand-500">Statut</div>
          <div className="text-2xl font-semibold mt-1">
            {CHANTIER_STATUS_LABEL[chantier.status as keyof typeof CHANTIER_STATUS_LABEL]}
          </div>
          {chantier.started_on && (
            <div className="text-xs text-brand-500 mt-1">
              Démarré le {formatDate(chantier.started_on)}
            </div>
          )}
          {chantier.closed_on && (
            <div className="text-xs text-brand-500">
              Terminé le {formatDate(chantier.closed_on)}
            </div>
          )}
        </div>
      </section>

      <section className="card overflow-x-auto p-0">
        <h2 className="font-semibold p-4 pb-2">Matériaux consommés</h2>
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-brand-700">
            <tr>
              <th className="text-left px-3 py-2">Article</th>
              <th className="text-left px-3 py-2">SKU</th>
              <th className="text-right px-3 py-2">Quantité</th>
              <th className="text-right px-3 py-2">Coût unitaire moyen</th>
              <th className="text-right px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {aggregated.length ? (
              aggregated.map((a, i) => (
                <tr key={i} className="border-t border-brand-100">
                  <td className="px-3 py-2">
                    {(a.item as any) ? (
                      <Link
                        href={`/items/${(a.item as any).id}`}
                        className="hover:underline"
                      >
                        {(a.item as any).name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {(a.item as any)?.sku ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatQty(a.qty)} {(a.item as any)?.unit ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right">{formatEUR(a.avg_cost)}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatEUR(a.total)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-brand-500" colSpan={5}>
                  Aucune sortie matière liée à ce chantier.
                </td>
              </tr>
            )}
          </tbody>
          {aggregated.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-brand-100 bg-brand-50">
                <td className="px-3 py-2 font-semibold" colSpan={4}>
                  Total
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {formatEUR(grandTotal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>

      <section className="card overflow-x-auto p-0 no-print">
        <h2 className="font-semibold p-4 pb-2">Détail des sorties</h2>
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-brand-700">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Article</th>
              <th className="text-right px-3 py-2">Qté</th>
              <th className="text-right px-3 py-2">PU</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-left px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {moves?.length ? (
              moves.map((m) => (
                <tr key={m.id} className="border-t border-brand-100">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDate(m.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    {(m.item as any)?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatQty(m.quantity)} {(m.item as any)?.unit ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatEUR(m.cost_at_movement)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatEUR(
                      Number(m.cost_at_movement ?? 0) * Number(m.quantity),
                    )}
                  </td>
                  <td className="px-3 py-2">{m.note ?? "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-brand-500" colSpan={6}>
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card no-print">
        <form action={updateThis} className="space-y-3">
          <h2 className="font-semibold">Modifier le chantier</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nom</label>
              <input name="name" required defaultValue={chantier.name} className="input" />
            </div>
            <div>
              <label className="label">Statut</label>
              <select
                name="status"
                defaultValue={chantier.status}
                className="input"
              >
                {CHANTIER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CHANTIER_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Client</label>
              <input
                name="client"
                defaultValue={chantier.client ?? ""}
                className="input"
              />
            </div>
            <div>
              <label className="label">Démarrage</label>
              <input
                name="started_on"
                type="date"
                defaultValue={chantier.started_on ?? ""}
                className="input"
              />
            </div>
            <div className="col-span-2">
              <label className="label">Adresse</label>
              <input
                name="address"
                defaultValue={chantier.address ?? ""}
                className="input"
              />
            </div>
            <div>
              <label className="label">Date de fin (si terminé)</label>
              <input
                name="closed_on"
                type="date"
                defaultValue={chantier.closed_on ?? ""}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={chantier.notes ?? ""}
              className="input"
            />
          </div>
          <button className="btn-secondary">Enregistrer</button>
        </form>
      </section>
    </div>
  );
}
