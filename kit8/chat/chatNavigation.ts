// Chat - open a theme: web = a NEW browser window (a blocked pop-up = this window), iOS / Android = the route in this app (the same rule as the task window).
import { Platform } from 'react-native';
import { CHAT_ROUTE, CHAT_THEME_ROUTE, chatThemeParams, chatThemePath, isAppAddress, isSafeLink, type ChatThemeLink } from './chatModel';

type Router = { push: (to: any) => void };

export function openChatTheme(link: ChatThemeLink, router: Router, opts: { newWindow?: boolean } = {}): void {
  const newWindow = opts.newWindow !== false;
  if (newWindow && Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      if (window.open(chatThemePath(link), '_blank')) return;
    } catch {
      // the browser blocked the new window: this window below
    }
  }
  router.push({ pathname: CHAT_THEME_ROUTE, params: chatThemeParams(link) } as any);
}

export const openChatList = (router: Router): void => router.push(CHAT_ROUTE as any);

/**
 * A link of a message: web = a separate browser window; phone = a route of this app (an address of the app) or the system browser (an external address).
 * Anything that is not http(s) or an address of the app is refused (javascript:, data: ...). Returns false when nothing was opened.
 */
export async function openChatLink(url: string, router: Router): Promise<boolean> {
  if (!isSafeLink(url)) return false;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
  if (isAppAddress(url)) {
    router.push(url as any);
    return true;
  }
  const { Linking } = require('react-native');
  await Linking.openURL(url);
  return true;
}
