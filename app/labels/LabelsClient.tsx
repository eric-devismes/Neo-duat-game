"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type ItemLite = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  supplier: string | null;
};

export default function LabelsClient({
  items,
  initialIds,
}: {
  items: ItemLite[];
  initialIds: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialIds.length ? initialIds : items.map((i) => i.id)),
  );
  const [copies, setCopies] = useState(1);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const printable = useMemo(
    () =>
      items
        .filter((i) => selected.has(i.id))
        .flatMap((i) => Array.from({ length: copies }, () => i)),
    [items, selected, copies],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = { ...qrMap };
      for (const it of printable) {
        if (next[it.sku]) continue;
        next[it.sku] = await QRCode.toDataURL(it.sku, {
          margin: 0,
          width: 200,
          errorCorrectionLevel: "M",
        });
      }
      if (!cancelled) setQrMap(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printable]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Étiquettes QR</h1>
        <div className="flex gap-2 items-center">
          <label className="text-sm">
            Copies par article&nbsp;
            <input
              type="number"
              min={1}
              max={48}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
              className="input w-20 inline-block"
            />
          </label>
          <button onClick={() => window.print()} className="btn-primary">
            Imprimer
          </button>
        </div>
      </div>

      <div className="no-print card">
        <div className="flex gap-2 mb-2 text-sm">
          <button
            onClick={() => setSelected(new Set(items.map((i) => i.id)))}
            className="text-brand-700 hover:underline"
          >
            Tout sélectionner
          </button>
          <span>·</span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-brand-700 hover:underline"
          >
            Aucun
          </button>
        </div>
        <div className="grid gap-1 sm:grid-cols-2 max-h-96 overflow-auto">
          {items.map((i) => (
            <label
              key={i.id}
              className="flex items-center gap-2 text-sm border-b border-brand-50 py-1"
            >
              <input
                type="checkbox"
                checked={selected.has(i.id)}
                onChange={() => toggle(i.id)}
              />
              <span className="font-mono text-xs text-brand-500">{i.sku}</span>
              <span className="truncate">{i.name}</span>
            </label>
          ))}
          {!items.length && (
            <p className="text-sm text-brand-500">Aucun article.</p>
          )}
        </div>
      </div>

      <div className="print-sheet grid grid-cols-3 gap-2">
        {printable.map((it, idx) => (
          <div
            key={`${it.id}-${idx}`}
            className="card flex flex-col items-center justify-center text-center p-3 break-inside-avoid"
            style={{ minHeight: "5cm" }}
          >
            {qrMap[it.sku] ? (
              <img
                src={qrMap[it.sku]}
                alt={it.sku}
                className="w-32 h-32 mb-1"
              />
            ) : (
              <div className="w-32 h-32 mb-1 bg-brand-50 animate-pulse" />
            )}
            <div className="font-mono text-[10px] text-brand-700">{it.sku}</div>
            <div className="text-sm font-medium leading-tight mt-0.5">
              {it.name}
            </div>
            <div className="text-[10px] text-brand-500">
              {it.supplier ?? ""}
              {it.supplier ? " · " : ""}
              unité: {it.unit}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
