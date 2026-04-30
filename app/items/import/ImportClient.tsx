"use client";

import { useState, useTransition } from "react";
import { importItemsCSV, type ImportResult } from "./actions";

const SAMPLE = `sku,nom,catégorie,unité,fournisseur,stock min,notes
,Plot réglable 40-60mm,Plots,pcs,Jouplast,40,
,Lambourde alu 2.4m,Lambourdes,pcs,Jouplast,10,
,Vis terrasse inox 5x60,Visserie,boite,Spax,2,Boîte de 200
HM-LAME-XYZW,Lame composite gris,Lames,ml,Silvadec,30,`;

export default function ImportClient() {
  const [csv, setCsv] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    const fd = new FormData();
    fd.set("csv", csv);
    if (updateExisting) fd.set("update", "on");
    start(async () => {
      const r = await importItemsCSV(fd);
      setResult(r);
    });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setCsv(text);
  };

  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="label">Contenu CSV</label>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setCsv(SAMPLE)}
            className="text-brand-700 hover:underline"
          >
            Exemple
          </button>
          <span>·</span>
          <label className="text-brand-700 hover:underline cursor-pointer">
            Charger un fichier
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
              onChange={handleFile}
              className="hidden"
            />
          </label>
        </div>
      </div>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        className="input font-mono text-xs"
        rows={14}
        placeholder="Collez votre CSV ici (en-têtes en première ligne)…"
        required
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={updateExisting}
          onChange={(e) => setUpdateExisting(e.target.checked)}
        />
        Mettre à jour les références existantes (par SKU). Sinon ignorées.
      </label>
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Import en cours…" : "Importer"}
      </button>

      {result && (
        <div
          className={`rounded-lg p-3 text-sm ${
            result.ok
              ? "bg-green-50 border border-green-200 text-green-900"
              : "bg-amber-50 border border-amber-200 text-amber-900"
          }`}
        >
          <p>
            <strong>{result.created}</strong> créé(s),{" "}
            <strong>{result.updated}</strong> mis à jour,{" "}
            <strong>{result.skipped}</strong> ignoré(s).
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs list-disc pl-5">
              {result.errors.slice(0, 20).map((e, i) => (
                <li key={i}>
                  Ligne {e.row}: {e.message}
                </li>
              ))}
              {result.errors.length > 20 && (
                <li>… {result.errors.length - 20} autres erreurs</li>
              )}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
