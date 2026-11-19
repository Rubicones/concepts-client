import { describe, expect, it } from "vitest";
import { EnvError, parseServerEnv } from "./env";
import { clientFileKey, deliveryExportKey, projectObjectKey, safeName } from "./r2-keys";
import { parseViewerCookie } from "./viewer";

const ID = "6f1a3c6e-8a0b-4a49-9b8e-6f6c9b6f6a01";

describe("env", () => {
  const good = {
    SUPABASE_URL: "https://xyz.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "x".repeat(40),
    R2_ACCOUNT_ID: "acc",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    NEXT_PUBLIC_PLAYER_ORIGIN: "https://play.example.com/",
    DASHBOARD_TEST_MODE: "1",
  };

  it("parses, defaults the bucket and trims the player origin", () => {
    const env = parseServerEnv(good);
    expect(env.R2_BUCKET).toBe("forma");
    expect(env.NEXT_PUBLIC_PLAYER_ORIGIN).toBe("https://play.example.com");
    expect(env.DASHBOARD_TEST_MODE).toBe(true);
  });

  it("lists every problem in one readable error", () => {
    try {
      parseServerEnv({ ...good, SUPABASE_URL: "nope", R2_ACCESS_KEY_ID: "" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EnvError);
      const msg = (e as Error).message;
      expect(msg).toContain("SUPABASE_URL");
      expect(msg).toContain("R2_ACCESS_KEY_ID");
    }
  });
});

describe("R2 keys", () => {
  it("makes safe single-segment names and keeps the extension", () => {
    expect(safeName("../../etc/passwd")).toBe("passwd");
    expect(safeName("Brand Book (final) v2.PDF")).toBe("Brand-Book-final-v2.pdf");
    expect(safeName("Café logo.svg")).toBe("Cafe-logo.svg");
    expect(safeName(".env")).toBe("env");
    expect(safeName("")).toBe("file");
  });

  it("lays out client files and exports", () => {
    expect(clientFileKey(ID, ID, "a b.png")).toBe(`clients/${ID}/files/${ID}/a-b.png`);
    expect(deliveryExportKey(ID, "Kite_Spring_9x16_en_10s.mp4")).toBe(`deliveries/${ID}/exports/Kite_Spring_9x16_en_10s.mp4`);
    expect(() => clientFileKey("nope", ID, "a")).toThrow();
  });

  it("refuses traversal in project paths", () => {
    expect(projectObjectKey(ID, ["assets", "logo.svg"])).toBe(`projects/${ID}/assets/logo.svg`);
    expect(projectObjectKey(ID, ["..", "secret"])).toBeNull();
    expect(projectObjectKey(ID, [".env"])).toBeNull();
    expect(projectObjectKey("x", ["a.html"])).toBeNull();
  });
});

describe("viewer cookie", () => {
  it("reads accounts and Forma brands, ignores junk", () => {
    expect(parseViewerCookie(ID)).toEqual({ kind: "account", id: ID });
    expect(parseViewerCookie(`forma:${ID}`)).toEqual({ kind: "forma-brand", id: ID });
    expect(parseViewerCookie("forma:x")).toBeNull();
    expect(parseViewerCookie("'; drop table")).toBeNull();
    expect(parseViewerCookie(undefined)).toBeNull();
  });
});
