import { classifyScan, formatLabel, isProductFormat, normalizeCodeType, parseWifi, scanText, shouldAcceptScan, SCAN_REPEAT_MS } from '../../kit8/ui/components/media/scan/scanModel';

describe('scan model', () => {
  it('names of the code types, also the underscore names of the browser', () => {
    expect(normalizeCodeType('qr_code')).toBe('qr');
    expect(normalizeCodeType('EAN_13')).toBe('ean-13');
    expect(normalizeCodeType('data_matrix')).toBe('data-matrix');
    expect(formatLabel('ean-13')).toBe('EAN-13');
    expect(formatLabel('qr')).toBe('QR code');
    expect(formatLabel('something')).toBe('something');
    expect(formatLabel('')).toBe('Code');
    expect(isProductFormat('upc_a')).toBe(true);
    expect(isProductFormat('qr')).toBe(false);
  });
  it('a link, a bare web address, a mail, a phone', () => {
    expect(classifyScan('https://example.com/a?b=1')).toMatchObject({ kind: 'link', openUrl: 'https://example.com/a?b=1' });
    expect(classifyScan('www.example.com')).toMatchObject({ kind: 'link', openUrl: 'https://www.example.com' });
    expect(classifyScan('mailto:a@b.com?subject=x')).toMatchObject({ kind: 'email', lines: ['a@b.com'] });
    expect(classifyScan('a@b.com')).toMatchObject({ kind: 'email', openUrl: 'mailto:a@b.com' });
    expect(classifyScan('+49 (170) 123-4567')).toMatchObject({ kind: 'phone', openUrl: 'tel:+491701234567' });
    expect(classifyScan('tel:+4912')).toMatchObject({ kind: 'phone', openUrl: 'tel:+4912' });
  });
  it('a long number on an EAN barcode is a product, not a phone number', () => {
    expect(classifyScan('4006381333931', 'ean-13').kind).toBe('product');
    expect(classifyScan('4006381333931', 'qr').kind).toBe('phone');
  });
  it('Wi-Fi with escapes', () => {
    expect(parseWifi('WIFI:T:WPA;S:My\\;Net;P:pa\\:ss;H:true;;')).toEqual({ ssid: 'My;Net', password: 'pa:ss', security: 'WPA', hidden: true });
    expect(parseWifi('WIFI:T:nopass;S:Cafe;;')).toMatchObject({ ssid: 'Cafe', password: '', security: 'nopass' });
    expect(parseWifi('hello')).toBeNull();
    expect(parseWifi('WIFI:T:WPA;;')).toBeNull();
    const info = classifyScan('WIFI:T:WPA;S:Home;P:secret;;');
    expect(info.kind).toBe('wifi');
    expect(info.lines).toEqual(['Network: Home', 'Security: WPA', 'Password: secret']);
  });
  it('contact cards, events, geo, sms', () => {
    expect(classifyScan('BEGIN:VCARD\nFN:Ann Lee\nTEL;TYPE=CELL:+1 555 0100\nEMAIL:ann@x.com\nEND:VCARD').lines).toEqual(['Name: Ann Lee', 'Phone: +1 555 0100', 'E-mail: ann@x.com']);
    expect(classifyScan('MECARD:N:Lee,Ann;TEL:555;;')).toMatchObject({ kind: 'contact', lines: ['Name: Lee Ann', 'Phone: 555'] });
    expect(classifyScan('BEGIN:VEVENT\nSUMMARY:Party\nDTSTART:20261201T180000\nEND:VEVENT').lines).toEqual(['Title: Party', 'Starts: 20261201T180000']);
    expect(classifyScan('geo:52.5,13.4?z=5')).toMatchObject({ kind: 'geo', lines: ['52.5,13.4'], openUrl: 'geo:52.5,13.4?z=5' });
    expect(classifyScan('SMSTO:555:Hi: there')).toMatchObject({ kind: 'sms', openUrl: 'sms:555', lines: ['To: 555', 'Text: Hi: there'] });
  });
  it('anything else, and nothing, is text', () => {
    expect(classifyScan('hello world')).toMatchObject({ kind: 'text', lines: ['hello world'], openUrl: '' });
    expect(classifyScan('   ')).toMatchObject({ kind: 'text', lines: [] });
  });
  it('the text of a result: facts for a Wi-Fi code, the raw text for others', () => {
    expect(scanText({ value: 'WIFI:T:WPA;S:Home;P:secret;;', type: 'qr' })).toBe('Network: Home\nSecurity: WPA\nPassword: secret');
    expect(scanText({ value: 'https://a.b', type: 'qr' })).toBe('https://a.b');
  });
  it('the same code in the next frames is one scan', () => {
    const prev = { value: 'A', type: 'qr', at: 1000 };
    expect(shouldAcceptScan(null, { value: 'A', type: 'qr' }, 1000)).toBe(true);
    expect(shouldAcceptScan(prev, { value: 'A', type: 'qr' }, 1000 + SCAN_REPEAT_MS - 1)).toBe(false);
    expect(shouldAcceptScan(prev, { value: 'A', type: 'qr' }, 1000 + SCAN_REPEAT_MS)).toBe(true);
    expect(shouldAcceptScan(prev, { value: 'B', type: 'qr' }, 1001)).toBe(true);
    expect(shouldAcceptScan(prev, { value: '', type: 'qr' }, 9999)).toBe(false);
  });
});
