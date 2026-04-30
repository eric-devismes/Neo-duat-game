"use client";

export default function PrintButton({
  label = "Imprimer",
  className = "btn-secondary text-sm",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button onClick={() => window.print()} className={className}>
      {label}
    </button>
  );
}
