// Google Cloud Storage helpers for recipe images
// TODO: Full GCS implementation in Issue #7

import { ENV } from "./_core/env";

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const bucket = ENV.gcsBucket;
  if (!bucket) {
    throw new Error("Storage not configured. Set GCS_BUCKET environment variable (Issue #7).");
  }

  // TODO: Implement GCS upload in Issue #7
  throw new Error("GCS upload not yet implemented (Issue #7).");
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const bucket = ENV.gcsBucket;
  if (!bucket) {
    throw new Error("Storage not configured. Set GCS_BUCKET environment variable (Issue #7).");
  }

  // TODO: Implement GCS download URL in Issue #7
  throw new Error("GCS download not yet implemented (Issue #7).");
}
