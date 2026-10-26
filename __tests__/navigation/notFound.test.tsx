/** @jest-environment jsdom */
import React, { act } from 'react';
import fs from 'fs';
import path from 'path';

const mockReplace = jest.fn();
let mockPath = '/no/such/page';

jest.mock('expo-router', () => ({
    useRouter: () => ({ replace: mockReplace }),
    usePathname: () => mockPath,
}));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key }),
}));
jest.mock('react-native-paper', () => {
    const React = require('react');
    const { Text: RNText, View, Pressable } = require('react-native');
    return {
        useTheme: () => ({ colors: {} }),
        Surface: ({ children }: any) => <View>{children}</View>,
        Text: ({ children, ...p }: any) => <RNText {...p}>{children}</RNText>,
        Button: ({ children, onPress, testID }: any) => (
            <Pressable testID={testID} onPress={onPress}><RNText>{children}</RNText></Pressable>
        ),
    };
});

import NotFoundScreen from '../../app/+not-found';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

describe('404 page (app/+not-found.tsx)', () => {
    beforeEach(() => mockReplace.mockClear());

    it('shows 404, the unknown path and goes Home on press', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = createRoot(host);
        act(() => { root.render(<NotFoundScreen />); });
        expect(host.textContent).toContain('404');
        expect(host.textContent).toContain('Page not found');
        expect(host.querySelector('[data-testid="not-found-path"]')?.textContent).toBe('/no/such/page');
        act(() => { (host.querySelector('[data-testid="not-found-home"]') as HTMLElement).click(); });
        expect(mockReplace).toHaveBeenCalledWith('/home');
        act(() => root.unmount());
        host.remove();
    });

    it('is hidden from the Drawer and has English texts', () => {
        const layout = fs.readFileSync(path.join(__dirname, '..', '..', 'app', '_layout.tsx'), 'utf8');
        expect(layout).toMatch(/name="\+not-found"[^>]*display: 'none'/);
        const i18n = fs.readFileSync(path.join(__dirname, '..', '..', 'kit8', 'i18n', 'i18n.ts'), 'utf8');
        expect(i18n).toContain("goHome: 'Go to Home'");
    });
});
