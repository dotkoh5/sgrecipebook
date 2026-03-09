// AI Image Generation — Stability AI (Stable Diffusion)
import { ENV } from "./env";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

interface GenerateImageOptions {
  prompt: string;
}

interface GenerateImageResult {
  url: string;
}

/**
 * Generate a food image using Stability AI's Stable Diffusion API.
 * Returns a URL to the stored image (via GCS) or a data URL fallback.
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResult> {
  const apiKey = ENV.stabilityApiKey;
  if (!apiKey) {
    throw new Error("STABILITY_API_KEY not configured");
  }

  // Use Stable Image Core (SD3) for high-quality generation
  const url = "https://api.stability.ai/v2beta/stable-image/generate/core";

  const formData = new FormData();
  formData.append("prompt", options.prompt);
  formData.append("output_format", "webp");
  formData.append("aspect_ratio", "4:3"); // Good for food photos

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "image/*",
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ImageGen] Stability API error:", response.status, errorText);
    throw new Error(`Stability API ${response.status}: ${errorText.substring(0, 300)}`);
  }

  // Response is raw image bytes
  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const imageKey = `recipes/${nanoid(12)}.webp`;

  // Try to store in GCS, fall back to data URL
  try {
    const stored = await storagePut(imageKey, imageBuffer, "image/webp");
    return { url: stored.url };
  } catch {
    // GCS not configured yet — return base64 data URL as fallback
    const base64 = imageBuffer.toString("base64");
    return { url: `data:image/webp;base64,${base64}` };
  }
}
