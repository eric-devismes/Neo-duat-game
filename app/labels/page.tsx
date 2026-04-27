import { isConfigured, getSupabaseAdmin } from "@/lib/supabase/server";
import ConfigGate from "@/components/ConfigGate";
import LabelsClient from "./LabelsClient";

export const dynamic = "force-dynamic";

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  if (!isConfigured()) return <ConfigGate />;
  const sp = await searchParams;

  const sb = getSupabaseAdmin();
  const { data: items } = await sb
    .from("items")
    .select("id, sku, name, unit, supplier")
    .eq("archived", false)
    .order("name");

  const initialIds = (sp.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <LabelsClient
      items={items ?? []}
      initialIds={initialIds}
    />
  );
}
