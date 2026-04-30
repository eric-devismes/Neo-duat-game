import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card max-w-xl mx-auto mt-8 text-center">
      <h1 className="text-xl font-semibold mb-2">Page introuvable</h1>
      <p className="text-sm text-brand-700 mb-4">
        Cette adresse ne correspond à aucune page.
      </p>
      <Link href="/" className="btn-primary">
        Tableau de bord
      </Link>
    </div>
  );
}
