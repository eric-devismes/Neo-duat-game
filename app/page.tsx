import Link from "next/link";
import { isConfigured, getSupabaseAdmin } from "@/lib/supabase/server";
import { formatEUR, formatQty } from "@/lib/format";
import ConfigGate from "@/components/ConfigGate";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  if (!isConfigured()) return <ConfigGate />;

  const sb = getSupabaseAdmin();
  const [{ data: items }, { data: lastMoves }] = await Promise.all([
    sb.from("items").select("*").eq("archived", false),
    sb
      .from("movements")
      .select("id, kind, quantity, unit_cost, created_at, item:items(sku,name,unit)")
      .is("voided_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const totalValue =
    items?.reduce((s, i) => s + Number(i.total_value ?? 0), 0) ?? 0;
  const totalRefs = items?.length ?? 0;
  const lowStock =
    items?.filter((i) => Number(i.quantity) <= Number(i.min_stock)) ?? [];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-xs text-brand-500 uppercase">Valeur stock</div>
          <div className="text-2xl font-semibold mt-1">{formatEUR(totalValue)}</div>
        </div>
        <div className="card">
          <div className="text-xs text-brand-500 uppercase">Références</div>
          <div className="text-2xl font-semibold mt-1">{totalRefs}</div>
        </div>
        <div className="card">
          <div className="text-xs text-brand-500 uppercase">Stock bas</div>
          <div className="text-2xl font-semibold mt-1 text-red-700">
            {lowStock.length}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/scan" className="btn-primary text-center text-base py-3">
          Scanner un article
        </Link>
        <Link href="/items/new" className="btn-secondary text-center text-base py-3">
          Nouvelle référence
        </Link>
        <Link href="/chantiers/new" className="btn-secondary text-center text-base py-3">
          Nouveau chantier
        </Link>
      </section>

      {lowStock.length > 0 && (
        <section className="card">
          <h2 className="font-semibold mb-2">Stock bas</h2>
          <ul className="text-sm divide-y divide-brand-100">
            {lowStock.slice(0, 6).map((i) => (
              <li key={i.id} className="py-2 flex justify-between">
                <Link href={`/items/${i.id}`} className="hover:underline">
                  {i.name}
                </Link>
                <span className="text-brand-700">
                  {formatQty(i.quantity)} {i.unit} (seuil {formatQty(i.min_stock)})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Derniers mouvements</h2>
          <Link href="/movements" className="text-sm text-brand-500 hover:underline">
            tout voir →
          </Link>
        </div>
        {!lastMoves?.length ? (
          <p className="text-sm text-brand-700">Aucun mouvement pour le moment.</p>
        ) : (
          <ul className="text-sm divide-y divide-brand-100">
            {lastMoves.map((m: any) => (
              <li key={m.id} className="py-2 flex justify-between">
                <span>
                  <span
                    className={
                      m.kind === "IN"
                        ? "text-green-700 font-semibold"
                        : "text-red-700 font-semibold"
                    }
                  >
                    {m.kind === "IN" ? "+" : "−"}
                    {formatQty(m.quantity)}
                  </span>{" "}
                  {m.item?.name ?? "—"}
                </span>
                <span className="text-brand-700">
                  {m.kind === "IN" && m.unit_cost != null
                    ? formatEUR(Number(m.unit_cost))
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
