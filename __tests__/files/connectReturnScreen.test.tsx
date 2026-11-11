/** @jest-environment jsdom */
// The page Google consent comes back to (/user/files): without this route the browser showed the 404 page after "Connect Google Drive".
import React, { act } from 'react';

const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }), useLocalSearchParams: () => mockParams }));
jest.mock('react-native-paper', () => {
    const { Text: RNText, View, Pressable } = require('react-native');
    return {
        useTheme: () => ({ colors: {} }),
        Surface: ({ children }: any) => <View>{children}</View>,
        Text: ({ children, ...p }: any) => <RNText {...p}>{children}</RNText>,
        Button: ({ children, onPress, testID }: any) => <Pressable testID={testID} onPress={onPress}><RNText>{children}</RNText></Pressable>,
    };
});

import Screen from '../../app/user/files';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

const show = (params: Record<string, string>) => {
    mockParams = params;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => { root.render(<Screen />); });
    return { host, done: () => { act(() => root.unmount()); host.remove(); } };
};

describe('app/user/files (the return of the Google consent)', () => {
    beforeEach(() => { mockReplace.mockClear(); jest.useFakeTimers(); });
    afterEach(() => jest.useRealTimers());

    it('ok: says connected and goes back to the dashboard by itself', () => {
        const v = show({ filesConnect: 'ok' });
        expect(v.host.textContent).toContain('Google Drive is connected');
        act(() => { jest.advanceTimersByTime(1600); });
        expect(mockReplace).toHaveBeenCalledWith('/pm/project/dashboard');
        v.done();
    });
    it('error: shows the reason and stays until the button is pressed', () => {
        const v = show({ filesConnect: 'error', reason: 'state expired - try again' });
        expect(v.host.textContent).toContain('was not connected');
        expect(v.host.querySelector('[data-testid="files-connect-reason"]')?.textContent).toBe('state expired - try again');
        act(() => { jest.advanceTimersByTime(5000); });
        expect(mockReplace).not.toHaveBeenCalled();
        act(() => { (v.host.querySelector('[data-testid="files-connect-back"]') as HTMLElement).click(); });
        expect(mockReplace).toHaveBeenCalledWith('/pm/project/dashboard');
        v.done();
    });
});
