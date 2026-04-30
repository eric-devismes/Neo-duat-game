"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Html5Qrcode } from "html5-qrcode";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import type { Item } from "@/lib/types";
import { formatEUR, formatQty } from "@/lib/format";
import {
  enqueueMovement,
  getCachedBySku,
  type CachedItem,
} from "@/lib/queue/db";
import {
  flushQueue,
  refreshItemCache,
  tryRegisterBackgroundSync,
} from "@/lib/queue/sync";

type Mode = "scan" | "form" | "saving" | "ok" | "error";
type ItemRef = Item | (CachedItem & { min_stock?: number; total_value?: number });

function extractSku(raw: string): string {
  try {
    const u = new URL(raw);
    const fromQuery = u.searchParams.get("sku");
    if (fromQuery) return fromQuery;
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && /^HM-/i.test(last)) return last;
  } catch {
    /* not a URL */
  }
  return raw.trim();
}

function feedbackOk() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(40);
  }
  try {
    const Ctx =
      typeof window !== "undefined"
        ? (window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext)
        : null;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 100);
  } catch {
    /* ignore */
  }
}

export default function ScanClient() {
  const elRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [mode, setMode] = useState<Mode>("scan");
  const [item, setItem] = useState<ItemRef | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [kind, setKind] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState<string>("1");
  const [unitCost, setUnitCost] = useState<string>("");
  const [site, setSite] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [manualSku, setManualSku] = useState<string>("");
  const [savedOffline, setSavedOffline] = useState(false);

  // Refresh local cache on mount, drain queue if any
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      refreshItemCache().catch(() => {});
      flushQueue().catch(() => {});
    }
  }, []);

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
    // Try local cache first (works offline + faster)
    const cached = await getCachedBySku(sku).catch(() => undefined);
    if (cached) {
      setItem(cached);
      resetForm();
      setMode("form");
      return;
    }
    // Fallback to network
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setErrorMsg(
        `Article "${sku}" non trouvé dans le cache local. Reconnectez-vous au réseau et réessayez.`,
      );
      setMode("error");
      return;
    }
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
    resetForm();
    setMode("form");
  }

  function resetForm() {
    setQuantity("1");
    setUnitCost("");
    setSite("");
    setNote("");
    setKind("IN");
    setSavedOffline(false);
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

    const payload = {
      item_id: item.id,
      kind,
      quantity: qty,
      unit_cost: kind === "IN" ? Number(unitCost) : null,
      site: kind === "OUT" ? site || null : null,
      note: note || null,
    };

    // Try direct insert first
    if (typeof navigator === "undefined" || navigator.onLine) {
      const sb = getSupabaseBrowser();
      const { error } = await sb.from("movements").insert(payload);
      if (!error) {
        feedbackOk();
        setSavedOffline(false);
        setMode("ok");
        return;
      }
      // Network/CORS/etc: fall through to queue
      console.warn("Online insert failed, queuing", error);
    }

    // Offline (or insert failed): queue locally
    try {
      await enqueueMovement(payload);
      await tryRegisterBackgroundSync();
      feedbackOk();
      setSavedOffline(true);
      setMode("ok");
    } catch (e) {
      setErrorMsg(String((e as Error)?.message ?? e));
      setMode("error");
    }
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
            Stock actuel:{" "}
            <strong>
              {formatQty(item.quantity)} {item.unit}
            </strong>
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
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input text-lg flex-1"
                autoFocus
              />
              {[1, 5, 10].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() =>
                    setQuantity(String(Math.max(0, Number(quantity || 0) + n)))
                  }
                  className="btn-secondary px-3 text-sm"
                >
                  +{n}
                </button>
              ))}
            </div>
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
          {errorMsg && <p className="text-sm text-red-700">{errorMsg}</p>}
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
        <div
          className={
            savedOffline
              ? "card bg-amber-50 border-amber-200"
              : "card bg-green-50 border-green-200"
          }
        >
          <h1
            className={
              savedOffline
                ? "text-xl font-semibold text-amber-900"
                : "text-xl font-semibold text-green-900"
            }
          >
            {savedOffline
              ? "Mouvement mis en file ✓"
              : "Mouvement enregistré ✓"}
          </h1>
          <p
            className={
              savedOffline
                ? "text-sm text-amber-900 mt-1"
                : "text-sm text-green-900 mt-1"
            }
          >
            {kind === "IN" ? "Entrée" : "Sortie"} de {quantity} {item.unit} pour{" "}
            {item.name}.
            {savedOffline &&
              " Sera synchronisé automatiquement au retour réseau."}
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
