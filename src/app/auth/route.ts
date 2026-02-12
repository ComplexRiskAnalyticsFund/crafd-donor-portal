import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string) {
  // Compare constant-time to reduce timing attacks for short secrets
  const ah = Buffer.from(createHash("sha256").update(a).digest("hex"));
  const bh = Buffer.from(createHash("sha256").update(b).digest("hex"));
  return ah.length === bh.length && timingSafeEqual(ah, bh);
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    const redirect = String(form.get("redirect") ?? "/");

    const expectedUsername = process.env.SITE_USERNAME ?? "";
    const expectedPassword = process.env.SITE_PASSWORD ?? "";

    if (!expectedUsername || !expectedPassword) {
      return NextResponse.redirect(new URL("/login/?error=1", req.url));
    }

    const usernameMatch = safeEqual(username, expectedUsername);
    const passwordMatch = safeEqual(password, expectedPassword);

    if (usernameMatch && passwordMatch) {
      const origin = new URL(req.url).origin;
      const finalRedirect = (redirect || "/").replace(/\/?$/, "/");
      const redirectUrl = new URL(finalRedirect, origin);

      const response = NextResponse.redirect(redirectUrl, { status: 303 });
      response.cookies.set("site_auth", "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    }

    return NextResponse.redirect(new URL("/login/?error=1", req.url));
  } catch (error) {
    return NextResponse.redirect(new URL("/login/?error=1", req.url));
  }
}
