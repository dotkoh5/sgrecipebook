// Google Cloud Storage helpers for recipe images
import { Storage } from "@google-cloud/storage";
import { ENV } from "./_core/env";

let storageClient: Storage | null = null;

function getStorage(): Storage {
  if (!storageClient) {
    // On Vercel: use GCS_SERVICE_ACCOUNT_KEY env var (base64-encoded JSON)
    // Locally: falls back to GOOGLE_APPLICATION_CREDENTIALS file path
    const serviceAccountKey = process.env.GCS_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      const credentials = JSON.parse(
        Buffer.from(serviceAccountKey, "base64").toString("utf-8")
      );
      storageClient = new Storage({
        projectId: ENV.gcsProjectId || credentials.project_id,
        credentials,
      });
    } else {
      storageClient = new Storage({
        projectId: ENV.gcsProjectId || undefined,
      });
    }
  }
  return storageClient;
}

function getBucket() {
  const bucketName = ENV.gcsBucket;
  if (!bucketName) {
    throw new Error("Storage not configured. Set GCS_BUCKET environment variable.");
  }
  return getStorage().bucket(bucketName);
}

/**
 * Upload a file to GCS and return the public URL.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const bucket = getBucket();
  const file = bucket.file(relKey);

  await file.save(data instanceof Buffer ? data : Buffer.from(data), {
    contentType,
    metadata: {
      cacheControl: "public, max-age=31536000", // 1 year cache
    },
  });

  // Make publicly readable
  await file.makePublic();

  const url = `https://storage.googleapis.com/${ENV.gcsBucket}/${relKey}`;
  return { key: relKey, url };
}

/**
 * Get the public URL for a stored file.
 */
export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const url = `https://storage.googleapis.com/${ENV.gcsBucket}/${relKey}`;
  return { key: relKey, url };
}
