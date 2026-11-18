import {
  applyMatrixToPixel, DEFAULT_PHOTO_FILTER, filterById, filtersOfGroup, IDENTITY_MATRIX, isBlackAndWhite, isIdentity, monoMatrix, multiplyMatrices, PHOTO_FILTERS, saturationMatrix,
} from '../../kit8/ui/components/media/photo/photoFilters';
import { buildNfcPost, buildPhotoPost, buildScanPost } from '../../kit8/ui/components/media/common/notePost';

describe('photo filters', () => {
  it('every filter has an id, a label and a 4x5 matrix; ids are unique; the default is the original', () => {
    expect(new Set(PHOTO_FILTERS.map((f) => f.id)).size).toBe(PHOTO_FILTERS.length);
    for (const f of PHOTO_FILTERS) {
      expect(f.matrix).toHaveLength(20);
      expect(f.matrix.every((n) => Number.isFinite(n))).toBe(true);
      expect(f.label.length).toBeGreaterThan(0);
    }
    expect(filterById(DEFAULT_PHOTO_FILTER).matrix).toEqual(IDENTITY_MATRIX);
    expect(filterById('nothing').id).toBe('original');
    expect(isIdentity('original')).toBe(true);
    expect(isIdentity('mono')).toBe(false);
  });
  it('there are black and white modes and colour looks', () => {
    expect(filtersOfGroup('bw').length).toBeGreaterThanOrEqual(4);
    expect(filtersOfGroup('color').length).toBeGreaterThanOrEqual(5);
    expect(isBlackAndWhite('noir')).toBe(true);
    expect(isBlackAndWhite('vivid')).toBe(false);
  });
  it('a black and white filter gives a grey: R = G = B for any colour', () => {
    for (const f of filtersOfGroup('bw').filter((x) => x.id !== 'grain')) {
      for (const [r, g, b] of [[255, 0, 0], [10, 200, 90], [0, 0, 255], [120, 120, 120]]) {
        const [R, G, B] = applyMatrixToPixel(f.matrix, r, g, b);
        expect(Math.abs(R - G)).toBeLessThanOrEqual(1);
        expect(Math.abs(G - B)).toBeLessThanOrEqual(1);
      }
    }
  });
  it('mono keeps white white and black black; noir is more contrasty than mono; silver is flatter', () => {
    const mono = filterById('mono').matrix;
    expect(applyMatrixToPixel(mono, 255, 255, 255)).toEqual([255, 255, 255]);
    expect(applyMatrixToPixel(mono, 0, 0, 0)).toEqual([0, 0, 0]);
    const dark = [60, 60, 60] as const;
    const light = [190, 190, 190] as const;
    const spread = (id: string) => applyMatrixToPixel(filterById(id).matrix, ...light)[0] - applyMatrixToPixel(filterById(id).matrix, ...dark)[0];
    expect(spread('noir')).toBeGreaterThan(spread('mono'));
    expect(spread('silver')).toBeLessThan(spread('mono'));
  });
  it('the original changes nothing; saturation 0 is grey; vivid makes a colour stronger', () => {
    expect(applyMatrixToPixel(IDENTITY_MATRIX, 12, 130, 250)).toEqual([12, 130, 250]);
    const [r, g, b] = applyMatrixToPixel(saturationMatrix(0), 200, 40, 40);
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(1);
    const [vr, , vb] = applyMatrixToPixel(filterById('vivid').matrix, 200, 100, 100);
    expect(vr - vb).toBeGreaterThan(200 - 100);
  });
  it('warm gives more red than blue, cool the other way', () => {
    const warm = applyMatrixToPixel(filterById('warm').matrix, 128, 128, 128);
    const cool = applyMatrixToPixel(filterById('cool').matrix, 128, 128, 128);
    expect(warm[0]).toBeGreaterThan(warm[2]);
    expect(cool[2]).toBeGreaterThan(cool[0]);
  });
  it('values are clamped to 0..255; matrices multiply in order', () => {
    expect(applyMatrixToPixel(monoMatrix(3, 0.5), 255, 255, 255)).toEqual([255, 255, 255]);
    expect(applyMatrixToPixel(monoMatrix(3, -0.5), 0, 0, 0)).toEqual([0, 0, 0]);
    const ab = multiplyMatrices(saturationMatrix(0), monoMatrix(1));
    expect(applyMatrixToPixel(ab, 200, 40, 40)).toEqual(applyMatrixToPixel(monoMatrix(1), ...applyMatrixToPixel(saturationMatrix(0), 200, 40, 40)));
    expect(multiplyMatrices(IDENTITY_MATRIX, IDENTITY_MATRIX)).toEqual(IDENTITY_MATRIX);
  });
});

describe('result posts', () => {
  const base = { ownerGUID: 'u1', rowGUID: 'r1', platform: 'ios', now: new Date(2026, 10, 18, 9, 5, 0) };
  it('scan post: the text of the code is the description, a link is the origin', () => {
    const p = buildScanPost({ ...base, value: 'https://a.b/x', formatLabel: 'QR code', typeLabel: 'Link' });
    expect(p).toMatchObject({ rowGUID: 'r1', rowOwnerGUID: 'u1', rowParentGUID: 'empty' });
    expect(p.rowJSON).toMatchObject({ mediaPostTitle: 'QR code 2026-11-18 09:05', mediaPostSubTitle: 'QR code · Link', mediaPostDescription: 'https://a.b/x', mediaPostOrigin: 'https://a.b/x', dataOriginName: 'scanner', mediaScanValue: 'https://a.b/x' });
    expect(p.rowJSON.mediaKind).toBeUndefined();
    expect(buildScanPost({ ...base, value: 'hello', formatLabel: 'QR code', typeLabel: 'Text', title: ' My ' }).rowJSON).toMatchObject({ mediaPostTitle: 'My', mediaPostOrigin: '', mediaPostOriginType: 'text' });
  });
  it('NFC post', () => {
    const p = buildNfcPost({ ...base, tagId: '04A1', summary: 'Link · https://a.b', text: 'Tag id: 04A1\nLink: https://a.b', techTypes: ['NfcA'] });
    expect(p.rowJSON).toMatchObject({ mediaPostTitle: 'NFC tag 2026-11-18 09:05', mediaPostSubTitle: 'Link · https://a.b', dataOriginName: 'nfc', nfcTagId: '04A1', nfcTechTypes: ['NfcA'] });
    expect(p.rowJSON.mediaKind).toBeUndefined();
  });
  it('photo post: the file, the look, the zoom only when it is not 1×', () => {
    const p = buildPhotoPost({ ...base, uri: 'file:///docs/media/kitphoto_1.jpg', width: 3000, height: 4000, filterId: 'noir', filterLabel: 'Noir', zoomFactor: 2.04 });
    expect(p.rowJSON).toMatchObject({ mediaPostTitle: 'Photo 2026-11-18 09:05', mediaPostSubTitle: 'Photo · Noir', mediaPostOrigin: 'file:///docs/media/kitphoto_1.jpg', mediaImageUri: 'file:///docs/media/kitphoto_1.jpg', mediaPostMIME: 'image/jpeg', photoFilter: 'noir', photoWidth: 3000, photoHeight: 4000, photoZoomFactor: 2 });
    const plain = buildPhotoPost({ ...base, uri: 'kit8media://a.png', filterId: 'original', filterLabel: 'Original', zoomFactor: 1 });
    expect(plain.rowJSON).toMatchObject({ mediaPostSubTitle: 'Photo', mediaPostMIME: 'image/png' });
    expect(plain.rowJSON.photoZoomFactor).toBeUndefined();
  });
});
