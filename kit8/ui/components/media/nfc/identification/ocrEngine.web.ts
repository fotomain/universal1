// Web: no text recognition yet. The plan (documentation/PASSPORT_1ST_PHOTO_2ND_SCAN.html, P3) is tesseract.js in the browser with a MRZ model;
// a browser cannot do the NFC step anyway, so the identification flow says "use the phone" on the web.
export interface OcrBlock {
  text: string;
  boundingBox?: { x?: number; y?: number; width?: number; height?: number };
  lines?: Array<{ text: string; boundingBox?: { x?: number; y?: number; width?: number; height?: number } }>;
}

export function orderLines(blocks: OcrBlock[]): string[] {
  return blocks.map((b) => b.text);
}

export const ocrAvailable = (): boolean => false;

export async function recognizeLines(): Promise<string[]> {
  throw new Error('Text recognition from a photo is not available in a browser yet. Use the phone app, or type the document values.');
}
