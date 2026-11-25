// Loads the files of the chosen font (expo-font; the web build gets a @font-face). `system` needs no file. Returns true when the chosen font can be drawn.
import { useEffect, useState } from 'react';
import { FONT_FILES, FONT_ITALIC_FILES, FontName } from './fontCatalog';

const loaded = new Set<string>();

function filesOf(name: FontName): string[] {
  if (name === 'system') return [];
  return [...Object.values(FONT_FILES[name]), ...(FONT_ITALIC_FILES[name] ? [FONT_ITALIC_FILES[name] as string] : [])];
}

export function isFontLoaded(name: FontName): boolean {
  return filesOf(name).every((f) => loaded.has(f));
}

export async function loadFont(name: FontName): Promise<boolean> {
  const wanted = filesOf(name).filter((f) => !loaded.has(f));
  if (wanted.length === 0) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Font = require('expo-font');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FONT_ASSETS } = require('./fontAssets');
    const map: Record<string, any> = {};
    for (const f of wanted) map[f] = FONT_ASSETS[f];
    await Font.loadAsync(map);
    wanted.forEach((f) => loaded.add(f));
    return true;
  } catch (e) {
    console.warn('font could not be loaded', name, e);
    return false;
  }
}

export function useAppFonts(name: FontName): boolean {
  const [ready, setReady] = useState<boolean>(() => name === 'system' || isFontLoaded(name));
  useEffect(() => {
    let alive = true;
    if (name === 'system' || isFontLoaded(name)) { setReady(true); return; }
    setReady(false);
    loadFont(name).then((ok) => { if (alive) setReady(ok); });
    return () => { alive = false; };
  }, [name]);
  return ready;
}
