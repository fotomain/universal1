// Web only: stop Chrome / Safari / Edge from painting autofilled inputs light blue (or yellow).
// The browser forces its own background + text color on :autofill and it cannot be overridden
// directly; delaying the color transition "forever" keeps the input's own colors.
// Injected once (idempotent); a no-op on iOS / Android and in SSR.
import { Platform } from 'react-native';

const STYLE_ID = 'app-no-autofill-highlight';

const CSS = `
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
input:-webkit-autofill:active,
textarea:-webkit-autofill,
select:-webkit-autofill,
input:autofill {
  -webkit-background-clip: text !important;
  background-clip: text !important;
  transition: background-color 600000s 0s, color 600000s 0s !important;
  box-shadow: none !important;
}
`;

export function installNoAutofillHighlight(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
