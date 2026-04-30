"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { generateSKU } from "@/lib/sku";

export async function createItem(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nom requis");

  const sku = String(formData.get("sku") ?? "").trim() || generateSKU(name);
  const category = String(formData.get("category") ?? "").trim() || null;
  const unit = String(formData.get("unit") ?? "pcs");
  const supplier = String(formData.get("supplier") ?? "").trim() || null;
  const min_stock = Number(formData.get("min_stock") ?? 0) || 0;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("items")
    .insert({ name, sku, category, unit, supplier, min_stock, notes })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/inventory");
  redirect(`/items/${data.id}?created=1`);
}

export async function updateItem(id: string, formData: FormData) {
  const patch = {
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim() || null,
    unit: String(formData.get("unit") ?? "pcs"),
    supplier: String(formData.get("supplier") ?? "").trim() || null,
    min_stock: Number(formData.get("min_stock") ?? 0) || 0,
    notes: String(formData.get("notes") ?? "").trim() || null,
    archived: formData.get("archived") === "on",
  };
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("items").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/inventory");
  revalidatePath(`/items/${id}`);
}

export async function recordMovement(formData: FormData) {
  const item_id = String(formData.get("item_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const unit_cost_raw = formData.get("unit_cost");
  const unit_cost =
    unit_cost_raw == null || unit_cost_raw === "" ? null : Number(unit_cost_raw);
  const site = String(formData.get("site") ?? "").trim() || null;
  const chantier_id = String(formData.get("chantier_id") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!item_id) throw new Error("Article requis");
  if (!["IN", "OUT"].includes(kind)) throw new Error("Type de mouvement invalide");
  if (!Number.isFinite(quantity) || quantity <= 0)
    throw new Error("Quantité invalide");
  if (kind === "IN" && (unit_cost == null || unit_cost < 0))
    throw new Error("Prix d'achat unitaire requis pour une entrée");

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("movements").insert({
    item_id,
    kind,
    quantity,
    unit_cost: kind === "IN" ? unit_cost : null,
    site: kind === "OUT" ? site : null,
    chantier_id: kind === "OUT" ? chantier_id : null,
    note,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/movements");
  revalidatePath(`/items/${item_id}`);
}

export async function voidMovement(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "annulation";
  if (!id) throw new Error("id requis");

  const sb = getSupabaseAdmin();
  const { data: existing } = await sb
    .from("movements")
    .select("id, item_id, voided_at")
    .eq("id", id)
    .single();
  if (!existing) throw new Error("Mouvement introuvable");
  if (existing.voided_at) return; // déjà annulé

  const { error } = await sb
    .from("movements")
    .update({ voided_at: new Date().toISOString(), voided_reason: reason })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/movements");
  revalidatePath(`/items/${existing.item_id}`);
}

export async function restoreMovement(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id requis");

  const sb = getSupabaseAdmin();
  const { data: existing } = await sb
    .from("movements")
    .select("id, item_id, voided_at")
    .eq("id", id)
    .single();
  if (!existing) throw new Error("Mouvement introuvable");
  if (!existing.voided_at) return;

  const { error } = await sb
    .from("movements")
    .update({ voided_at: null, voided_reason: null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/movements");
  revalidatePath(`/items/${existing.item_id}`);
}

export async function findItemBySku(sku: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("items")
    .select("*")
    .eq("sku", sku)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
