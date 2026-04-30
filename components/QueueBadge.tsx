"use client";

import { useEffect, useState } from "react";
import { pendingMovements } from "@/lib/queue/db";
import { flushQueue } from "@/lib/queue/sync";

export default function QueueBadge() {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  async function refresh() {
    try {
      setCount((await pendingMovements()).length);
    } catch {
      // IndexedDB not ready yet
    }
  }

  async function sync() {
    if (busy) return;
    setBusy(true);
    try {
      const { remaining } = await flushQueue();
      setCount(remaining);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    const onOnline = () => {
      setOnline(true);
      sync();
    };
    const onOffline = () => setOnline(false);
    const onMessage = (e: MessageEvent) => {
      if (e.data === "flush-queue") sync();
    };
    const onFocus = () => refresh();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onFocus);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onMessage);
    }
    const interval = setInterval(refresh, 5000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocus);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onMessage);
      }
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!online) {
    return (
      <div className="no-print fixed bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-amber-100 border border-amber-300 px-3 py-1.5 text-xs text-amber-900 shadow">
        Hors-ligne · {count} mouvement{count !== 1 ? "s" : ""} en attente
      </div>
    );
  }

  if (count === 0) return null;
  return (
    <button
      onClick={sync}
      disabled={busy}
      className="no-print fixed bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-brand-700 text-white px-4 py-2 text-sm shadow-lg hover:bg-brand-900 disabled:opacity-60"
    >
      {busy
        ? `Synchronisation… (${count})`
        : `Synchroniser ${count} mouvement${count > 1 ? "s" : ""}`}
    </button>
  );
}
