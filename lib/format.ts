const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const num = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 3,
});

const dt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});

export const formatEUR = (n: number | null | undefined) =>
  n == null ? "—" : eur.format(Number(n));

export const formatQty = (n: number | null | undefined) =>
  n == null ? "—" : num.format(Number(n));

export const formatDate = (iso: string | null | undefined) =>
  iso ? dt.format(new Date(iso)) : "—";
