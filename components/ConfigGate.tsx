import Link from "next/link";

export default function ConfigGate() {
  return (
    <div className="card max-w-2xl mx-auto mt-8">
      <h1 className="text-xl font-semibold mb-2">Configuration Supabase requise</h1>
      <p className="text-sm text-brand-700 mb-4">
        L&apos;application a besoin d&apos;un projet Supabase pour fonctionner. Suivez les
        étapes du fichier <code>SETUP.md</code> pour créer votre projet et coller les
        identifiants dans <code>.env.local</code> (en local) ou les variables
        d&apos;environnement Vercel (en production).
      </p>
      <ol className="list-decimal pl-5 text-sm space-y-1">
        <li>Créer un projet Supabase gratuit</li>
        <li>
          Coller <code>supabase/schema.sql</code> dans le SQL Editor et exécuter
        </li>
        <li>
          Copier <em>Project URL</em>, <em>anon key</em> et <em>service role key</em>{" "}
          dans <code>.env.local</code>
        </li>
        <li>Redémarrer l&apos;app</li>
      </ol>
      <div className="mt-4">
        <Link href="/" className="btn-secondary">Retour</Link>
      </div>
    </div>
  );
}
