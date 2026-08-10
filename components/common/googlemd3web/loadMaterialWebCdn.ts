import { Platform } from 'react-native';

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

export default loadMaterialWebCdn;
