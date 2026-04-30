import Link from "next/link";
import { isConfigured, getSupabaseAdmin } from "@/lib/supabase/server";
import { formatEUR, formatDate } from "@/lib/format";
import { CHANTIER_STATUS_LABEL } from "@/lib/types";
import ConfigGate from "@/components/ConfigGate";

export const dynamic = "force-dynamic";

export default async function ChantiersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!isConfigured()) return <ConfigGate />;
  const sp = await searchParams;
  const status = sp.status ?? "actif";

  const sb = getSupabaseAdmin();
  let q = sb.from("chantiers").select("*").order("started_on", { ascending: false });
  if (status !== "all") q = q.eq("status", status);
  const { data: chantiers, error } = await q;
  if (error) throw new Error(error.message);

  const ids = (chantiers ?? []).map((c) => c.id);
  let costsByChantier = new Map<string, { total_cost: number; nb: number }>();
  if (ids.length) {
    const { data: costs } = await sb
      .from("chantier_costs")
      .select("chantier_id, total_cost, nb_articles")
      .in("chantier_id", ids);
    for (const c of costs ?? []) {
      costsByChantier.set(c.chantier_id, {
        total_cost: Number(c.total_cost ?? 0),
        nb: Number(c.nb_articles ?? 0),
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Chantiers</h1>
        <Link href="/chantiers/new" className="btn-primary text-sm">
          + Chantier
        </Link>
      </div>

      <nav className="card flex gap-1 text-sm overflow-x-auto">
        {(["actif", "termine", "archive", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/chantiers?status=${s}`}
            className={`px-3 py-1.5 rounded-md ${
              status === s
                ? "bg-brand-700 text-white"
                : "text-brand-700 hover:bg-brand-50"
            }`}
          >
            {s === "all" ? "Tous" : CHANTIER_STATUS_LABEL[s]}
          </Link>
        ))}
      </nav>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-brand-700">
            <tr>
              <th className="text-left px-3 py-2">Chantier</th>
              <th className="text-left px-3 py-2">Client</th>
              <th className="text-left px-3 py-2">Démarré</th>
              <th className="text-right px-3 py-2">Articles</th>
              <th className="text-right px-3 py-2">Coût matière</th>
              <th className="text-left px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {chantiers?.length ? (
              chantiers.map((c) => {
                const cost = costsByChantier.get(c.id) ?? { total_cost: 0, nb: 0 };
                return (
                  <tr key={c.id} className="border-t border-brand-100">
                    <td className="px-3 py-2">
                      <Link href={`/chantiers/${c.id}`} className="hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{c.client ?? "—"}</td>
                    <td className="px-3 py-2">{formatDate(c.started_on)}</td>
                    <td className="px-3 py-2 text-right">{cost.nb}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatEUR(cost.total_cost)}
                    </td>
                    <td className="px-3 py-2">
                      {CHANTIER_STATUS_LABEL[c.status as keyof typeof CHANTIER_STATUS_LABEL]}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-brand-500" colSpan={6}>
                  Aucun chantier.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
