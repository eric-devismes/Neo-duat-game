"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPasscode, sessionCookie } from "@/lib/auth";

export async function login(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const from = String(formData.get("from") ?? "/") || "/";

  if (!checkPasscode(code)) {
    redirect("/login?error=1");
  }
  const { name, value, options } = await sessionCookie();
  (await cookies()).set(name, value, options);
  redirect(from.startsWith("/login") ? "/" : from);
}
