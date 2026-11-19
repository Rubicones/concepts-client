import "server-only";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, type GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv } from "./env";

export * from "./r2-keys";

/** 2 GB per client upload (spec §4.2). */
export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3;

let client: S3Client | undefined;

export function r2(): S3Client {
  if (!client) {
    const env = serverEnv();
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    });
  }
  return client;
}

const bucket = () => serverEnv().R2_BUCKET;

/** Presigned PUT for a direct browser → R2 upload. The browser must send the same Content-Type. */
export async function presignPut(key: string, contentType: string, expiresIn = 60 * 60): Promise<string> {
  return getSignedUrl(r2(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), {
    expiresIn,
  });
}

/** Presigned GET; `downloadName` sets Content-Disposition so a direct click saves with our naming scheme. */
export async function presignGet(key: string, opts: { downloadName?: string; expiresIn?: number } = {}): Promise<string> {
  const disposition = opts.downloadName
    ? `attachment; filename*=UTF-8''${encodeURIComponent(opts.downloadName)}`
    : undefined;
  return getSignedUrl(
    r2(),
    new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentDisposition: disposition }),
    { expiresIn: opts.expiresIn ?? 60 * 30 },
  );
}

/** Reads an object, optionally a byte range ("bytes=0-1023"). Returns null when it does not exist. */
export async function getObject(key: string, range?: string): Promise<GetObjectCommandOutput | null> {
  try {
    return await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key, Range: range }));
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw err;
  }
}

/** Every key under a prefix (paginated). */
export async function listKeys(prefix: string): Promise<{ key: string; lastModified?: Date }[]> {
  const out: { key: string; lastModified?: Date }[] = [];
  let token: string | undefined;
  do {
    const page = await r2().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }));
    for (const o of page.Contents ?? []) if (o.Key) out.push({ key: o.Key, lastModified: o.LastModified });
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/** Reads and parses a JSON object; null when missing. */
export async function getJson<T>(key: string): Promise<T | null> {
  const obj = await getObject(key);
  if (!obj?.Body) return null;
  return JSON.parse(await obj.Body.transformToString("utf-8")) as T;
}

/** Size of an object, or null when it does not exist. */
export async function headObject(key: string): Promise<{ size: number; contentType?: string } | null> {
  try {
    const h = await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: h.ContentLength ?? 0, contentType: h.ContentType };
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

/** Deletes an object; a missing one is fine. Only for dashboard-owned prefixes (clients/…). */
export async function deleteObject(key: string): Promise<void> {
  if (!key.startsWith("clients/")) throw new Error("The dashboard only deletes its own files.");
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** Writes an object from the server. Test mode only uses it (seeding sample exports); never outside deliveries/. */
export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  if (!key.startsWith("deliveries/")) throw new Error("The dashboard only writes sample exports.");
  await r2().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}
