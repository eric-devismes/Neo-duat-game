import { JWT } from "google-auth-library";

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  );
}

function getJWT() {
  return new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function fetchSheets(path: string, init?: RequestInit) {
  const jwt = getJWT();
  const { token } = await jwt.getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function clearAndWrite(tab: string, values: unknown[][]) {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const range = `${tab}!A1:ZZ`;
  await fetchSheets(`/${id}/values/${encodeURIComponent(range)}:clear`, {
    method: "POST",
  });
  await fetchSheets(
    `/${id}/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values }) },
  );
}

export async function syncToSheets(payload: {
  items: unknown[][];
  movements: unknown[][];
}) {
  if (!isConfigured()) {
    throw new Error(
      "Google Sheets non configuré (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID)",
    );
  }
  await clearAndWrite("Articles", payload.items);
  await clearAndWrite("Mouvements", payload.movements);
}

export const sheetsConfigured = isConfigured;
