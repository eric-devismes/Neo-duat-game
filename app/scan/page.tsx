import { isConfigured } from "@/lib/supabase/server";
import ConfigGate from "@/components/ConfigGate";
import ScanClient from "./ScanClient";

export default function ScanPage() {
  if (!isConfigured()) return <ConfigGate />;
  return <ScanClient />;
}
