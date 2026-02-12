import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const response = NextResponse.redirect(new URL("/login", origin), {
    status: 303,
  });

  // Get basePath from environment or default to '/'
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/";
  const cookiePath = basePath === "" ? "/" : basePath;

  // Clear the auth cookie with the same path it was set
  response.cookies.set("site_auth", "", {
    path: cookiePath,
    maxAge: 0,
  });

  return response;
}

// Also support GET for simple link-based logout
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const response = NextResponse.redirect(new URL("/login", origin), {
    status: 303,
  });

  // Get basePath from environment or default to '/'
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/";
  const cookiePath = basePath === "" ? "/" : basePath;

  // Clear the auth cookie with the same path it was set
  response.cookies.set("site_auth", "", {
    path: cookiePath,
    maxAge: 0,
  });

  return response;
}
