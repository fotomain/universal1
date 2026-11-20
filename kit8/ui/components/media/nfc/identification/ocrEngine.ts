// Text recognition on the phone: expo-mlkit-ocr = Google ML Kit text recognition v2 (Android: the BUNDLED model, works offline from the first start;
// iOS: the ML Kit pod with Apple Vision as the fallback on the simulator). The photo never leaves the device.
import * as MlKit from 'expo-mlkit-ocr';

export interface OcrBlock {
  text: string;
  boundingBox?: { x?: number; y?: number; width?: number; height?: number };
  lines?: Array<{ text: string; boundingBox?: { x?: number; y?: number; width?: number; height?: number } }>;
}

/** the lines of all blocks, top to bottom (a block may hold several lines; the engine orders blocks by its own taste) */
export function orderLines(blocks: OcrBlock[]): string[] {
  const rows: Array<{ y: number; x: number; text: string }> = [];
  for (const b of blocks) {
    const lines = b.lines && b.lines.length ? b.lines : [{ text: b.text, boundingBox: b.boundingBox }];
    for (const l of lines) rows.push({ y: l.boundingBox?.y ?? b.boundingBox?.y ?? 0, x: l.boundingBox?.x ?? 0, text: l.text });
  }
  rows.sort((a, b) => a.y - b.y || a.x - b.x);
  return rows.map((r) => r.text).filter((t) => t.trim().length > 0);
}

export const ocrAvailable = (): boolean => {
  try {
    return MlKit.isSupported();
  } catch {
    return false;
  }
};

/** recognises the text of an image file (a file:// uri); resolves with the text lines top to bottom */
export async function recognizeLines(imageUri: string): Promise<string[]> {
  const result = await MlKit.recognizeText(imageUri);
  return orderLines((result?.blocks ?? []) as OcrBlock[]);
}
