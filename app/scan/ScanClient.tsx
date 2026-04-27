"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Html5Qrcode } from "html5-qrcode";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import type { Item } from "@/lib/types";
import { formatEUR, formatQty } from "@/lib/format";

type Mode = "scan" | "form" | "saving" | "ok" | "error";

function extractSku(raw: string): string {
  // Accept either bare SKU or a URL like https://app/scan?sku=HM-XXXX-YYYY
  try {
    const u = new URL(raw);
    const fromQuery = u.searchParams.get("sku");
    if (fromQuery) return fromQuery;
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && /^HM-/i.test(last)) return last;
  } catch {
    // not a URL
  }
  return raw.trim();
}

export default function ScanClient() {
  const elRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [mode, setMode] = useState<Mode>("scan");
  const [item, setItem] = useState<Item | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [kind, setKind] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState<string>("1");
  const [unitCost, setUnitCost] = useState<string>("");
  const [site, setSite] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [manualSku, setManualSku] = useState<string>("");

  useEffect(() => {
    if (mode !== "scan" || !elRef.current) return;
    const scanner = new Html5Qrcode(elRef.current.id);
    scannerRef.current = scanner;
    let stopped = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          if (stopped) return;
          stopped = true;
          await scanner.stop().catch(() => {});
          await loadSku(extractSku(decoded));
        },
        () => {},
      )
      .catch((e) => {
        setErrorMsg(
          "Impossible d'accéder à la caméra. Saisissez le SKU manuellement.\n" +
            String(e?.message ?? e),
        );
      });

    return () => {
      stopped = true;
      scanner.stop().catch(() => {});
      scanner.clear().catch(() => {});
    };
  }, [mode]);

  async function loadSku(sku: string) {
    setErrorMsg("");
    const sb = getSupabaseBrowser();
    const { data, error } = await sb
      .from("items")
      .select("*")
      .eq("sku", sku)
      .maybeSingle();
    if (error) {
      setErrorMsg(error.message);
      setMode("error");
      return;
    }
    if (!data) {
      setErrorMsg(`Aucun article avec le SKU "${sku}"`);
      setMode("error");
      return;
    }
    setItem(data as Item);
    setQuantity("1");
    setUnitCost("");
    setSite("");
    setNote("");
    setKind("IN");
    setMode("form");
  }

  async function submit() {
    if (!item) return;
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorMsg("Quantité invalide");
      return;
    }
    if (kind === "IN" && (!unitCost || Number(unitCost) < 0)) {
      setErrorMsg("Prix unitaire requis pour une entrée");
      return;
    }
    setMode("saving");
    const sb = getSupabaseBrowser();
    const { error } = await sb.from("movements").insert({
      item_id: item.id,
      kind,
      quantity: qty,
      unit_cost: kind === "IN" ? Number(unitCost) : null,
      site: kind === "OUT" ? site || null : null,
      note: note || null,
    });
    if (error) {
      setErrorMsg(error.message);
      setMode("error");
      return;
    }
    setMode("ok");
  }

  if (mode === "scan") {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Scanner un article</h1>
        <div
          id="scanner"
          ref={elRef}
          className="rounded-xl overflow-hidden border border-brand-100 bg-black aspect-square max-w-md mx-auto"
        />
        <p className="text-sm text-brand-700 text-center">
          Pointez la caméra vers un QR-code Home_Made.
        </p>
        {errorMsg && (
          <pre className="card whitespace-pre-wrap text-xs text-red-700">
            {errorMsg}
          </pre>
        )}
        <div className="card">
          <label className="label">Saisie manuelle du SKU</label>
          <div className="flex gap-2">
            <input
              className="input flex-1 font-mono"
              placeholder="HM-XXXX-YYYY"
              value={manualSku}
              onChange={(e) => setManualSku(e.target.value.toUpperCase())}
            />
            <button
              className="btn-primary"
              onClick={() => loadSku(manualSku.trim())}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "form" && item) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <button
          onClick={() => setMode("scan")}
          className="text-sm text-brand-700 hover:underline"
        >
          ← Scanner un autre article
        </button>
        <div className="card">
          <div className="text-xs uppercase text-brand-500">{item.sku}</div>
          <h1 className="text-xl font-semibold">{item.name}</h1>
          <div className="mt-2 text-sm text-brand-700">
            Stock actuel: <strong>{formatQty(item.quantity)} {item.unit}</strong>
            {" · "}CMUP: <strong>{formatEUR(item.avg_unit_cost)}</strong>
          </div>
        </div>
        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("IN")}
              className={`rounded-lg px-3 py-3 font-semibold ${
                kind === "IN"
                  ? "bg-green-700 text-white"
                  : "bg-brand-50 text-brand-700"
              }`}
            >
              + Entrée (achat)
            </button>
            <button
              type="button"
              onClick={() => setKind("OUT")}
              className={`rounded-lg px-3 py-3 font-semibold ${
                kind === "OUT"
                  ? "bg-red-700 text-white"
                  : "bg-brand-50 text-brand-700"
              }`}
            >
              − Sortie (chantier)
            </button>
          </div>
          <div>
            <label className="label">Quantité ({item.unit})</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input text-lg"
              autoFocus
            />
          </div>
          {kind === "IN" && (
            <div>
              <label className="label">Prix d&apos;achat unitaire HT (EUR)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="input text-lg"
                placeholder="ex: 4.95"
              />
            </div>
          )}
          {kind === "OUT" && (
            <div>
              <label className="label">Chantier (optionnel)</label>
              <input
                value={site}
                onChange={(e) => setSite(e.target.value)}
                className="input"
                placeholder="ex: Terrasse Dupont"
              />
            </div>
          )}
          <div>
            <label className="label">Note (optionnel)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input"
            />
          </div>
          {errorMsg && (
            <p className="text-sm text-red-700">{errorMsg}</p>
          )}
          <button onClick={submit} className="btn-primary w-full text-lg py-3">
            Valider
          </button>
        </div>
      </div>
    );
  }

  if (mode === "saving") {
    return <p className="text-center py-12">Enregistrement…</p>;
  }

  if (mode === "ok" && item) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="card bg-green-50 border-green-200">
          <h1 className="text-xl font-semibold text-green-900">Mouvement enregistré ✓</h1>
          <p className="text-sm text-green-900 mt-1">
            {kind === "IN" ? "Entrée" : "Sortie"} de {quantity} {item.unit} pour {item.name}.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn-primary"
            onClick={() => {
              setItem(null);
              setMode("scan");
            }}
          >
            Scanner suivant
          </button>
          <Link href={`/items/${item.id}`} className="btn-secondary text-center">
            Voir l&apos;article
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <pre className="card whitespace-pre-wrap text-sm text-red-700">
        {errorMsg || "Erreur"}
      </pre>
      <button onClick={() => setMode("scan")} className="btn-secondary">
        Réessayer
      </button>
    </div>
  );
}
