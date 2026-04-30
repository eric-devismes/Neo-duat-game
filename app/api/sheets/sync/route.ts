import { NextResponse } from "next/server";
import { getSupabaseAdmin, isConfigured } from "@/lib/supabase/server";
import { sheetsConfigured, syncToSheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  return run();
}
export async function POST() {
  return run();
}

async function run() {
  if (!isConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase non configuré" },
      { status: 500 },
    );
  }
  if (!sheetsConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Google Sheets non configuré. Voir SETUP.md (étape 'Synchronisation Google Sheets').",
      },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const [{ data: items }, { data: moves }] = await Promise.all([
    sb
      .from("items")
      .select(
        "sku, name, category, unit, supplier, quantity, min_stock, avg_unit_cost, total_value, archived, notes, updated_at",
      )
      .order("name"),
    sb
      .from("movements")
      .select(
        "created_at, kind, quantity, unit_cost, site, note, item:items(sku, name, unit)",
      )
      .is("voided_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const itemRows: unknown[][] = [
    [
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
      "Mis à jour",
    ],
    ...(items ?? []).map((i) => [
      i.sku,
      i.name,
      i.category ?? "",
      i.unit,
      i.supplier ?? "",
      Number(i.quantity),
      Number(i.min_stock),
      Number(i.avg_unit_cost),
      Number(i.total_value),
      i.archived ? "oui" : "non",
      i.notes ?? "",
      i.updated_at,
    ]),
  ];

  const moveRows: unknown[][] = [
    [
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
    ],
    ...(moves ?? []).map((m: any) => [
      m.created_at,
      m.kind,
      m.item?.sku ?? "",
      m.item?.name ?? "",
      m.item?.unit ?? "",
      Number(m.quantity),
      m.unit_cost != null ? Number(m.unit_cost) : "",
      m.unit_cost != null ? Number(m.unit_cost) * Number(m.quantity) : "",
      m.site ?? "",
      m.note ?? "",
    ]),
  ];

  try {
    await syncToSheets({ items: itemRows, movements: moveRows });
    return NextResponse.json({
      ok: true,
      items: itemRows.length - 1,
      movements: moveRows.length - 1,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 },
    );
  }
}
