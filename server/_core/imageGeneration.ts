// AI Image Generation
// TODO: Implement in Issue #6

interface GenerateImageOptions {
  prompt: string;
}

interface GenerateImageResult {
  url: string;
}

export async function generateImage(
  _options: GenerateImageOptions
): Promise<GenerateImageResult> {
  throw new Error(
    "Image generation not configured. Implement DALL-E or similar (Issue #6)."
  );
}
