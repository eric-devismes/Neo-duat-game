export type Unit = "pcs" | "m" | "m2" | "ml" | "kg" | "L" | "sac" | "boite";

export const UNITS: Unit[] = ["pcs", "m", "m2", "ml", "kg", "L", "sac", "boite"];

export const UNIT_LABEL: Record<Unit, string> = {
  pcs: "pièce",
  m: "mètre",
  m2: "m²",
  ml: "mètre linéaire",
  kg: "kg",
  L: "litre",
  sac: "sac",
  boite: "boîte",
};

export type Item = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: Unit;
  supplier: string | null;
  min_stock: number;
  notes: string | null;
  quantity: number;
  avg_unit_cost: number;
  total_value: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type Movement = {
  id: string;
  item_id: string;
  kind: "IN" | "OUT";
  quantity: number;
  unit_cost: number | null;
  site: string | null;
  note: string | null;
  created_at: string;
};

export type MovementWithItem = Movement & {
  item: Pick<Item, "id" | "sku" | "name" | "unit"> | null;
};
