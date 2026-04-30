// Minimal RFC4180-ish CSV parser (handles quoted fields, escaped quotes,
// CR/LF line endings). Good enough for spreadsheet exports pasted by hand.

export function parseCSV(input: string): string[][] {
  // Strip a UTF-8 BOM if present
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  // Detect separator: tab if any TSV-style line, else comma, else semicolon
  // (Excel FR exports often use ';')
  const firstLine = input.split(/\r\n|\r|\n/, 1)[0] ?? "";
  let sep = ",";
  if (firstLine.includes("\t")) sep = "\t";
  else if (firstLine.includes(";") && !firstLine.includes(",")) sep = ";";

  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === sep) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      if (input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Flush last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully empty trailing rows
  while (rows.length && rows[rows.length - 1].every((v) => v === "")) rows.pop();
  return rows;
}
