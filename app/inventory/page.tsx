import Link from "next/link";
import { isConfigured, getSupabaseAdmin } from "@/lib/supabase/server";
import { formatEUR, formatQty } from "@/lib/format";
import ConfigGate from "@/components/ConfigGate";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; show?: string }>;
}) {
  if (!isConfigured()) return <ConfigGate />;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const cat = (sp.cat ?? "").trim();
  const includeArchived = sp.show === "all";

  const sb = getSupabaseAdmin();
  let query = sb.from("items").select("*").order("name");
  if (!includeArchived) query = query.eq("archived", false);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,supplier.ilike.%${q}%`);
  if (cat) query = query.eq("category", cat);

  const { data: items, error } = await query;
  if (error) throw new Error(error.message);

  const { data: catRows } = await sb
    .from("items")
    .select("category")
    .not("category", "is", null);
  const categories = Array.from(
    new Set((catRows ?? []).map((r) => r.category).filter(Boolean) as string[]),
  ).sort();

  const totalValue =
    items?.reduce((s, i) => s + Number(i.total_value ?? 0), 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Stock</h1>
        <div className="flex gap-2">
          <a href="/api/export/items.csv" className="btn-secondary text-sm">
            Export CSV
          </a>
          <a href="/api/sheets/sync" className="btn-secondary text-sm">
            Sync Google Sheets
          </a>
          <Link href="/items/import" className="btn-secondary text-sm">
            Import CSV
          </Link>
          <Link href="/items/new" className="btn-primary text-sm">
            + Référence
          </Link>
        </div>
      </div>

      <form className="card flex flex-wrap gap-2" action="/inventory">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher (nom, SKU, fournisseur)"
          className="input flex-1 min-w-[200px]"
        />
        <select name="cat" defaultValue={cat} className="input max-w-[180px]">
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="show"
            value="all"
            defaultChecked={includeArchived}
          />
          inclure archivés
        </label>
        <button className="btn-secondary text-sm">Filtrer</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-brand-700">
            <tr>
              <th className="text-left px-3 py-2">Article</th>
              <th className="text-left px-3 py-2">SKU</th>
              <th className="text-left px-3 py-2">Catégorie</th>
              <th className="text-right px-3 py-2">Stock</th>
              <th className="text-right px-3 py-2">CMUP</th>
              <th className="text-right px-3 py-2">Valeur</th>
            </tr>
          </thead>
          <tbody>
            {items?.length ? (
              items.map((i) => {
                const low = Number(i.quantity) <= Number(i.min_stock);
                return (
                  <tr
                    key={i.id}
                    className={`border-t border-brand-100 ${
                      i.archived ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <Link href={`/items/${i.id}`} className="hover:underline">
                        {i.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{i.sku}</td>
                    <td className="px-3 py-2">{i.category ?? "—"}</td>
                    <td
                      className={`px-3 py-2 text-right ${
                        low ? "text-red-700 font-semibold" : ""
                      }`}
                    >
                      {formatQty(i.quantity)} {i.unit}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatEUR(i.avg_unit_cost)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatEUR(i.total_value)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-brand-500" colSpan={6}>
                  Aucun article. <Link href="/items/new" className="underline">Créer le premier</Link>.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-brand-100 bg-brand-50">
              <td className="px-3 py-2 font-semibold" colSpan={5}>
                Total
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {formatEUR(totalValue)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
