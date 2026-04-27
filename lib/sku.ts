// Generate a short, human-friendly, unique-ish SKU.
// Format: HM-XXXX-YYYY  (4 chars from name + 4 random)
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1

function rand(len: number) {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  }
  return out;
}

function slugPart(name: string) {
  const cleaned = name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "");
  return (cleaned + "XXXX").slice(0, 4);
}

export function generateSKU(name: string) {
  return `HM-${slugPart(name)}-${rand(4)}`;
}
