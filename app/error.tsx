"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card max-w-xl mx-auto mt-8">
      <h1 className="text-xl font-semibold mb-2">Une erreur est survenue</h1>
      <p className="text-sm text-brand-700 mb-4">
        {error.message || "Erreur inconnue. Réessayez ou rechargez la page."}
      </p>
      {error.digest && (
        <p className="text-xs font-mono text-brand-500 mb-4">
          Code: {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <button onClick={reset} className="btn-primary">
          Réessayer
        </button>
        <a href="/" className="btn-secondary">
          Tableau de bord
        </a>
      </div>
    </div>
  );
}
