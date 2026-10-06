import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

const CORE_CUSTOM_ELEMENTS = ['md-filled-button', 'md-switch', 'md-outlined-text-field'];

export function loadMaterialWebCdn() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    if ((window as any).__MATERIAL_WEB_CDN_LOADED__) {
      return;
    }
    (window as any).__MATERIAL_WEB_CDN_LOADED__ = true;
    const scriptId = 'material-web-cdn-all-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'module';
      script.src = 'https://esm.run/@material/web/all.js';
      document.head.appendChild(script);
    }
  }
}

/**
 * Synchronous check if Google Material Design 3 Web custom elements are defined.
 */
export function isGoogleMD3WebReadySync(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.customElements) {
    return true;
  }
  return Boolean(window.customElements.get('md-filled-button'));
}

/**
 * Asynchronous Promise-based check that triggers loading and waits for custom elements to register.
 */
export async function isGoogleMD3WebReady(timeoutMs: number = 5000): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.customElements) {
    return true;
  }

  // Ensure CDN script is loaded
  loadMaterialWebCdn();

  // If already registered, return true immediately
  if (isGoogleMD3WebReadySync()) {
    return true;
  }

  const whenDefinedPromises = CORE_CUSTOM_ELEMENTS.map((tag) =>
    window.customElements.whenDefined(tag)
  );

  const timeoutPromise = new Promise<boolean>((resolve) =>
    setTimeout(() => resolve(false), timeoutMs)
  );

  try {
    const ready = await Promise.race([
      Promise.all(whenDefinedPromises).then(() => true),
      timeoutPromise,
    ]);
    return ready;
  } catch {
    return false;
  }
}

/**
 * React Hook to check and observe Google Material Design 3 Web readiness.
 */
export function useIsGoogleMD3WebReady(): boolean {
  const [ready, setReady] = useState<boolean>(() => isGoogleMD3WebReadySync());

  useEffect(() => {
    if (ready || Platform.OS !== 'web') return;

    let isMounted = true;
    isGoogleMD3WebReady().then((isReady) => {
      if (isMounted && isReady) {
        setReady(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [ready]);

  return ready;
}

export default loadMaterialWebCdn;
