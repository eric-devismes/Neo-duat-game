import Link from "next/link";

const links = [
  { href: "/", label: "Tableau" },
  { href: "/scan", label: "Scanner" },
  { href: "/inventory", label: "Stock" },
  { href: "/movements", label: "Mouvements" },
  { href: "/labels", label: "Étiquettes" },
];

export default function Nav() {
  return (
    <header className="no-print sticky top-0 z-10 border-b border-brand-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-brand-900">
          Home_Made <span className="text-brand-500 font-normal">· stock</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-brand-700 hover:bg-brand-50"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
