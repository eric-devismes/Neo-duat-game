import { isConfigured, getSupabaseAdmin } from "@/lib/supabase/server";
import ConfigGate from "@/components/ConfigGate";
import ScanClient from "./ScanClient";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  if (!isConfigured()) return <ConfigGate />;
  const sb = getSupabaseAdmin();
  const { data: chantiers } = await sb
    .from("chantiers")
    .select("id, name")
    .eq("status", "actif")
    .order("name");
  return <ScanClient chantiers={chantiers ?? []} />;
}
