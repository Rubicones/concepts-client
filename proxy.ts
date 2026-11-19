import { NextResponse, type NextRequest } from "next/server";
import { decideHost, hostOf } from "./lib/player/hosts";

/**
 * Splits the app host from the creative player host (spec §3.3).
 * Model-written HTML must never run on the dashboard's origin, and the player
 * origin must expose nothing but creatives and their libraries.
 */
const playerHost = hostOf(process.env.NEXT_PUBLIC_PLAYER_ORIGIN);

export function proxy(request: NextRequest) {
  const decision = decideHost({
    host: request.headers.get("host"),
    pathname: request.nextUrl.pathname,
    playerHost,
  });
  if (decision === "deny") {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  return NextResponse.next();
}

export const config = {
  // Static build assets need no decision; everything else (pages, routes, public files) passes through.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
