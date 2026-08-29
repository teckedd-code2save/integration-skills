import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Bucket, r2Client } from "./client";

function expiry(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 900) {
    throw new Error("Presigned URL expiry must be between 1 and 900 seconds");
  }
  return value;
}

export function createObjectKey(input: { ownerId: string; extension?: string }) {
  const owner = input.ownerId.replace(/[^a-zA-Z0-9_-]/g, "-");
  if (!owner) throw new Error("ownerId is required");
  const extension = input.extension?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `${owner}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
}

export function putR2Object(input: {
  key: string;
  body: Uint8Array | Buffer | string;
  contentType: string;
}) {
  return r2Client().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
}

export function headR2Object(key: string) {
  return r2Client().send(new HeadObjectCommand({ Bucket: r2Bucket(), Key: key }));
}

export function deleteR2Object(key: string) {
  return r2Client().send(new DeleteObjectCommand({ Bucket: r2Bucket(), Key: key }));
}

export function createR2UploadUrl(input: {
  key: string;
  contentType: string;
  expiresIn?: number;
}) {
  return getSignedUrl(
    r2Client(),
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: input.key,
      ContentType: input.contentType,
    }),
    { expiresIn: expiry(input.expiresIn ?? 300) },
  );
}

export function createR2DownloadUrl(key: string, expiresIn = 300) {
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({ Bucket: r2Bucket(), Key: key }),
    { expiresIn: expiry(expiresIn) },
  );
}
