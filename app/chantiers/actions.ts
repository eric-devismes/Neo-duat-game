"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function createChantier(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nom requis");
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("chantiers")
    .insert({
      name,
      client: String(formData.get("client") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      started_on: String(formData.get("started_on") ?? "") || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/chantiers");
  redirect(`/chantiers/${data.id}`);
}

export async function updateChantier(id: string, formData: FormData) {
  const sb = getSupabaseAdmin();
  const status = String(formData.get("status") ?? "actif");
  const closed_on =
    status === "termine"
      ? String(formData.get("closed_on") ?? "") || new Date().toISOString().slice(0, 10)
      : null;
  const { error } = await sb
    .from("chantiers")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      client: String(formData.get("client") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      status,
      started_on: String(formData.get("started_on") ?? "") || null,
      closed_on,
      notes: String(formData.get("notes") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/chantiers");
  revalidatePath(`/chantiers/${id}`);
}
