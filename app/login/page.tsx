import { authEnabled } from "@/lib/auth";
import { login } from "./actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  if (!authEnabled()) redirect("/");
  const sp = await searchParams;

  return (
    <div className="max-w-sm mx-auto pt-12">
      <div className="card">
        <h1 className="text-xl font-semibold mb-1">Home_Made</h1>
        <p className="text-sm text-brand-700 mb-4">
          Saisissez le code d&apos;accès pour continuer.
        </p>
        <form action={login} className="space-y-3">
          <input type="hidden" name="from" value={sp.from ?? "/"} />
          <input
            name="code"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            className="input text-center text-2xl tracking-[0.5em]"
            placeholder="••••"
          />
          {sp.error && (
            <p className="text-sm text-red-700 text-center">Code incorrect.</p>
          )}
          <button className="btn-primary w-full text-lg py-3">Entrer</button>
        </form>
      </div>
    </div>
  );
}
