import { getSupabaseAdmin, isConfigured } from "@/lib/supabase/server";
import { csvResponse, toCSV } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isConfigured()) {
    return new Response("Supabase non configuré", { status: 500 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("items")
    .select(
      "sku, name, category, unit, supplier, quantity, min_stock, avg_unit_cost, total_value, archived, notes, created_at, updated_at",
    )
    .order("name");

  if (error) return new Response(error.message, { status: 500 });

  const headers = [
    "SKU",
    "Nom",
    "Catégorie",
    "Unité",
    "Fournisseur",
    "Stock",
    "Stock min",
    "CMUP (EUR)",
    "Valeur stock (EUR)",
    "Archivé",
    "Notes",
    "Créé le",
    "Mis à jour",
  ];
  const rows = (data ?? []).map((i) => [
    i.sku,
    i.name,
    i.category ?? "",
    i.unit,
    i.supplier ?? "",
    i.quantity,
    i.min_stock,
    i.avg_unit_cost,
    i.total_value,
    i.archived ? "oui" : "non",
    i.notes ?? "",
    i.created_at,
    i.updated_at,
  ]);
  return csvResponse("home_made_articles.csv", toCSV(headers, rows));
}
