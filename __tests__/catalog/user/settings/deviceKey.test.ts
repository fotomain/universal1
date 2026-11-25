import { computeDeviceKey } from '../../../../kit8/catalog/user/settings/deviceKey';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  androidPhone: 'Mozilla/5.0 (Linux; Android 14; SM-A336B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

describe('computeDeviceKey', () => {
  it('native apps use expo-device', () => {
    expect(computeDeviceKey({ platformOS: 'ios', expoDeviceType: 1 })).toEqual({ deviceType: 'phone', os: 'ios' });
    expect(computeDeviceKey({ platformOS: 'ios', expoDeviceType: 2 })).toEqual({ deviceType: 'tablet', os: 'ipados' });
    expect(computeDeviceKey({ platformOS: 'android', expoDeviceType: 1 })).toEqual({ deviceType: 'phone', os: 'android' });
    expect(computeDeviceKey({ platformOS: 'android', expoDeviceType: 2 })).toEqual({ deviceType: 'tablet', os: 'android' });
    expect(computeDeviceKey({ platformOS: 'macos' })).toEqual({ deviceType: 'desktop', os: 'macos' });
    expect(computeDeviceKey({ platformOS: 'windows' })).toEqual({ deviceType: 'desktop', os: 'windows' });
  });
  it('the web reads the user agent', () => {
    expect(computeDeviceKey({ platformOS: 'web', userAgent: UA.iphone })).toEqual({ deviceType: 'phone', os: 'ios' });
    expect(computeDeviceKey({ platformOS: 'web', userAgent: UA.ipad })).toEqual({ deviceType: 'tablet', os: 'ipados' });
    expect(computeDeviceKey({ platformOS: 'web', userAgent: UA.macSafari, maxTouchPoints: 0 })).toEqual({ deviceType: 'desktop', os: 'macos' });
    expect(computeDeviceKey({ platformOS: 'web', userAgent: UA.win })).toEqual({ deviceType: 'desktop', os: 'windows' });
    expect(computeDeviceKey({ platformOS: 'web', userAgent: UA.linux })).toEqual({ deviceType: 'desktop', os: 'linux' });
    expect(computeDeviceKey({ platformOS: 'web', userAgent: UA.androidPhone })).toEqual({ deviceType: 'phone', os: 'android' });
    expect(computeDeviceKey({ platformOS: 'web', userAgent: UA.androidTablet, screenMinSide: 800 })).toEqual({ deviceType: 'tablet', os: 'android' });
  });
  it('an iPad in "desktop site" mode says Macintosh: the touch screen tells it apart', () => {
    expect(computeDeviceKey({ platformOS: 'web', userAgent: UA.macSafari, maxTouchPoints: 5 })).toEqual({ deviceType: 'tablet', os: 'ipados' });
  });
  it('an unknown device never fails', () => {
    expect(computeDeviceKey({ platformOS: 'web', userAgent: '' })).toEqual({ deviceType: 'desktop', os: 'other' });
    expect(computeDeviceKey({ platformOS: 'web' })).toEqual({ deviceType: 'desktop', os: 'other' });
  });
});
