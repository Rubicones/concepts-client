/**
 * Host split (spec §3.3): the player host serves only /p/* and /lib/*; the app
 * host never serves them. Pure, so the proxy decision is unit-tested.
 */

export const PLAYER_PATHS = /^\/(p|lib)(\/|$)/;

export function hostOf(origin: string | undefined | null): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

export type HostDecision = "allow" | "deny";

export function decideHost({
  host,
  pathname,
  playerHost,
}: {
  host: string | null;
  pathname: string;
  playerHost: string | null;
}): HostDecision {
  const isPlayerPath = PLAYER_PATHS.test(pathname);
  const onPlayerHost = Boolean(playerHost && host && host.toLowerCase() === playerHost);
  if (onPlayerHost) return isPlayerPath ? "allow" : "deny";
  return isPlayerPath ? "deny" : "allow";
}
