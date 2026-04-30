"use client";

import { getSupabaseBrowser } from "@/lib/supabase/browser";
import {
  bumpAttempt,
  cacheItems,
  pendingMovements,
  removeFromQueue,
  type CachedItem,
} from "./db";

export async function refreshItemCache(): Promise<number> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb
    .from("items")
    .select("id, sku, name, unit, quantity, avg_unit_cost, category, supplier")
    .eq("archived", false);
  if (error) throw error;
  await cacheItems((data as CachedItem[]) ?? []);
  return data?.length ?? 0;
}

export async function flushQueue(): Promise<{
  sent: number;
  remaining: number;
  errors: string[];
}> {
  const sb = getSupabaseBrowser();
  const queued = await pendingMovements();
  const errors: string[] = [];
  let sent = 0;
  for (const m of queued) {
    const { error } = await sb.from("movements").insert({
      item_id: m.item_id,
      kind: m.kind,
      quantity: m.quantity,
      unit_cost: m.unit_cost,
      site: m.site,
      note: m.note,
      created_at: m.queued_at,
    });
    if (error) {
      errors.push(`${m.localId}: ${error.message}`);
      await bumpAttempt(m.localId).catch(() => {});
    } else {
      await removeFromQueue(m.localId).catch(() => {});
      sent++;
    }
  }
  const remaining = (await pendingMovements()).length;
  return { sent, remaining, errors };
}

export async function tryRegisterBackgroundSync() {
  if (typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const anyReg = reg as unknown as {
      sync?: { register: (tag: string) => Promise<void> };
    };
    await anyReg.sync?.register("flush-queue");
  } catch {
    // Background Sync unsupported (Safari, etc) — fall back to 'online' event.
  }
}
