// Auth utilities — uses Web Crypto so it works in both the Edge
// runtime (middleware) and the Node runtime (server actions).

const COOKIE_NAME = "hm_session";
const ENC = new TextEncoder();

function passcode() {
  return (process.env.APP_PASSCODE ?? "").trim();
}

export function authEnabled() {
  return passcode().length > 0;
}

async function expectedToken() {
  const data = ENC.encode("hm-session:" + passcode());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function sessionCookie() {
  return {
    name: COOKIE_NAME,
    value: await expectedToken(),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    },
  };
}

export function clearedCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    options: { path: "/", maxAge: 0 },
  };
}

export async function isValid(cookieValue: string | undefined) {
  if (!authEnabled()) return true;
  if (!cookieValue) return false;
  const expected = await expectedToken();
  return constantTimeEqual(cookieValue, expected);
}

export function checkPasscode(input: string) {
  const expected = passcode();
  if (!expected) return false;
  return constantTimeEqual(input, expected);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
