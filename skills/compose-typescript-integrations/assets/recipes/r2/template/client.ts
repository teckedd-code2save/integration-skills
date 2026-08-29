import { S3Client } from "@aws-sdk/client-s3";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

let client: S3Client | undefined;

export function r2Client() {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${required("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

export function r2Bucket() {
  return required("R2_BUCKET");
}
