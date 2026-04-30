import Link from "next/link";
import { isConfigured, getSupabaseAdmin } from "@/lib/supabase/server";
import { formatEUR, formatQty, formatDate } from "@/lib/format";
import ConfigGate from "@/components/ConfigGate";
import { restoreMovement, voidMovement } from "@/app/items/actions";

export const dynamic = "force-dynamic";

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; site?: string; show?: string }>;
}) {
  if (!isConfigured()) return <ConfigGate />;
  const sp = await searchParams;
  const kind = sp.kind ?? "";
  const site = sp.site ?? "";
  const includeVoided = sp.show === "all";

  const sb = getSupabaseAdmin();
  let q = sb
    .from("movements")
    .select(
      "id, kind, quantity, unit_cost, site, note, created_at, voided_at, item:items(id, sku, name, unit)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (kind === "IN" || kind === "OUT") q = q.eq("kind", kind);
  if (site) q = q.ilike("site", `%${site}%`);
  if (!includeVoided) q = q.is("voided_at", null);

  const { data: moves, error } = await q;
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Mouvements</h1>
        <a href="/api/export/movements.csv" className="btn-secondary text-sm">
          Export CSV
        </a>
      </div>

      <form className="card flex flex-wrap gap-2" action="/movements">
        <select name="kind" defaultValue={kind} className="input max-w-[180px]">
          <option value="">Toutes opérations</option>
          <option value="IN">Entrées</option>
          <option value="OUT">Sorties</option>
        </select>
        <input
          name="site"
          defaultValue={site}
          placeholder="Chantier"
          className="input flex-1 min-w-[200px]"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="show"
            value="all"
            defaultChecked={includeVoided}
          />
          inclure annulés
        </label>
        <button className="btn-secondary text-sm">Filtrer</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-brand-700">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Article</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-right px-3 py-2">Qté</th>
              <th className="text-right px-3 py-2">PU</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-left px-3 py-2">Chantier</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {moves?.length ? (
              moves.map((m: any) => {
                const voided = !!m.voided_at;
                return (
                  <tr
                    key={m.id}
                    className={`border-t border-brand-100 ${
                      voided ? "line-through text-brand-500 bg-brand-50/50" : ""
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDate(m.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      {m.item ? (
                        <Link
                          href={`/items/${m.item.id}`}
                          className="hover:underline"
                        >
                          {m.item.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
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
                      {formatQty(m.quantity)} {m.item?.unit ?? ""}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.unit_cost != null ? formatEUR(m.unit_cost) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.unit_cost != null
                        ? formatEUR(Number(m.unit_cost) * Number(m.quantity))
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{m.site ?? "—"}</td>
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
                          <button className="text-xs text-red-700 hover:underline">
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
                <td className="px-3 py-6 text-center text-brand-500" colSpan={8}>
                  Aucun mouvement
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
