import { NextResponse } from "next/server";
import { clearedCookie } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    { status: 303 },
  );
  const { name, value, options } = clearedCookie();
  res.cookies.set(name, value, options);
  return res;
}

export const GET = POST;
