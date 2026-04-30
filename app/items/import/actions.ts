"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { parseCSV } from "@/lib/csv-parse";
import { generateSKU } from "@/lib/sku";
import { UNITS, type Unit } from "@/lib/types";

export type ImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

const HEADER_MAP: Record<string, string> = {
  sku: "sku",
  reference: "sku",
  référence: "sku",
  ref: "sku",
  nom: "name",
  name: "name",
  designation: "name",
  désignation: "name",
  category: "category",
  catégorie: "category",
  categorie: "category",
  unit: "unit",
  unité: "unit",
  unite: "unit",
  supplier: "supplier",
  fournisseur: "supplier",
  min_stock: "min_stock",
  "stock min": "min_stock",
  "stock minimum": "min_stock",
  notes: "notes",
};

function normalizeHeader(h: string) {
  return HEADER_MAP[h.trim().toLowerCase().replace(/^﻿/, "")] ?? "";
}

function parseUnit(v: string): Unit {
  const n = v.trim().toLowerCase();
  return (UNITS as readonly string[]).includes(n) ? (n as Unit) : "pcs";
}

function parseNum(v: string): number {
  if (!v) return 0;
  const cleaned = v.trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function importItemsCSV(formData: FormData): Promise<ImportResult> {
  const text = String(formData.get("csv") ?? "");
  const updateExisting = formData.get("update") === "on";

  if (!text.trim()) {
    return {
      ok: false,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [{ row: 0, message: "Aucun contenu CSV fourni" }],
    };
  }

  const rows = parseCSV(text);
  if (rows.length < 2) {
    return {
      ok: false,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [{ row: 0, message: "Le CSV doit contenir au moins une ligne d'en-tête + 1 ligne" }],
    };
  }

  const headerRow = rows[0].map(normalizeHeader);
  if (!headerRow.includes("name")) {
    return {
      ok: false,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [
        {
          row: 0,
          message:
            "Colonne 'nom' (ou 'name') obligatoire. En-têtes reconnues: sku, nom, catégorie, unité, fournisseur, stock min, notes.",
        },
      ],
    };
  }

  const sb = getSupabaseAdmin();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: ImportResult["errors"] = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const obj: Record<string, string> = {};
    headerRow.forEach((h, i) => {
      if (h) obj[h] = (cells[i] ?? "").trim();
    });

    const name = obj.name ?? "";
    if (!name) {
      errors.push({ row: r + 1, message: "Nom vide" });
      skipped++;
      continue;
    }

    const payload = {
      sku: obj.sku || generateSKU(name),
      name,
      category: obj.category || null,
      unit: parseUnit(obj.unit ?? "pcs"),
      supplier: obj.supplier || null,
      min_stock: parseNum(obj.min_stock ?? "0"),
      notes: obj.notes || null,
    };

    if (obj.sku) {
      const { data: existing } = await sb
        .from("items")
        .select("id")
        .eq("sku", payload.sku)
        .maybeSingle();
      if (existing) {
        if (updateExisting) {
          const { error } = await sb
            .from("items")
            .update({
              name: payload.name,
              category: payload.category,
              unit: payload.unit,
              supplier: payload.supplier,
              min_stock: payload.min_stock,
              notes: payload.notes,
            })
            .eq("id", existing.id);
          if (error) {
            errors.push({ row: r + 1, message: error.message });
            skipped++;
          } else {
            updated++;
          }
        } else {
          skipped++;
        }
        continue;
      }
    }

    const { error } = await sb.from("items").insert(payload);
    if (error) {
      errors.push({ row: r + 1, message: error.message });
      skipped++;
    } else {
      created++;
    }
  }

  revalidatePath("/inventory");
  return { ok: errors.length === 0, created, updated, skipped, errors };
}
