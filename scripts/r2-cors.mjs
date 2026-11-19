// One-time setup: lets the browser upload straight to R2 with presigned PUT URLs
// (questionnaire files) and stream exports into the download ZIP.
//
//   node --env-file=.env.local scripts/r2-cors.mjs https://app.example.com http://localhost:3000
//
// Origins: the arguments, or DASHBOARD_ORIGINS (comma-separated), or http://localhost:3000.
// It REPLACES the bucket's CORS rules; Forma itself does not need any (it uploads from the server).
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET = "forma", DASHBOARD_ORIGINS } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error("Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (e.g. node --env-file=.env.local …).");
  process.exit(1);
}
const origins = process.argv.slice(2).length ? process.argv.slice(2) : (DASHBOARD_ORIGINS ?? "http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean);

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const before = await s3.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET })).catch(() => null);
if (before?.CORSRules?.length) console.log("Current rules (will be replaced):", JSON.stringify(before.CORSRules));

await s3.send(
  new PutBucketCorsCommand({
    Bucket: R2_BUCKET,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: origins,
          AllowedMethods: ["PUT", "GET", "HEAD"],
          AllowedHeaders: ["content-type", "range"],
          ExposeHeaders: ["etag", "content-length", "content-range"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);
console.log(`CORS set on ${R2_BUCKET} for: ${origins.join(", ")}`);
