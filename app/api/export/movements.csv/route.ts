import { getSupabaseAdmin, isConfigured } from "@/lib/supabase/server";
import { csvResponse, toCSV } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isConfigured()) {
    return new Response("Supabase non configuré", { status: 500 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("movements")
    .select(
      "created_at, kind, quantity, unit_cost, site, note, item:items(sku, name, unit)",
    )
    .order("created_at", { ascending: false });
  if (error) return new Response(error.message, { status: 500 });

  const headers = [
    "Date",
    "Type",
    "SKU",
    "Article",
    "Unité",
    "Quantité",
    "PU (EUR)",
    "Total (EUR)",
    "Chantier",
    "Note",
  ];
  const rows = (data ?? []).map((m: any) => {
    const total =
      m.unit_cost != null ? Number(m.unit_cost) * Number(m.quantity) : "";
    return [
      m.created_at,
      m.kind,
      m.item?.sku ?? "",
      m.item?.name ?? "",
      m.item?.unit ?? "",
      m.quantity,
      m.unit_cost ?? "",
      total,
      m.site ?? "",
      m.note ?? "",
    ];
  });
  return csvResponse("home_made_mouvements.csv", toCSV(headers, rows));
}
