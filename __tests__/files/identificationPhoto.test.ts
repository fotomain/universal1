// The owner photo of an ID card -> the file storage: the file name, the folder words, the Blob of the bytes, the upload call.
import { blobOfBytes, identificationFileName, identificationPath, uploadIdentificationPhoto } from '../../kit8/files/common/identificationPhoto';

const POST = '12345678-1234-4234-8234-1234567890ab';
const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');

describe('identification photo', () => {
  it('the file is named by the post', () => {
    expect(identificationFileName(POST, 'image/jpeg')).toBe(`${POST}.jpg`);
    expect(identificationFileName(POST, 'image/jp2')).toBe(`${POST}.jp2`);
    expect(identificationFileName(POST, 'IMAGE/PNG')).toBe(`${POST}.png`);
    expect(identificationFileName(POST, 'application/x-unknown')).toBe(`${POST}.jpg`);
    expect(identificationPath('idcard')).toBe('identification/idcard');
    expect(identificationPath('passport')).toBe('identification/passport');
  });

  it('a Blob is made from the bytes; where a typed array cannot be a Blob (React Native) a data address is read instead', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const direct = await blobOfBytes(bytes, 'image/jpeg', b64);
    expect(direct.size).toBe(3);
    const RealBlob = (globalThis as any).Blob;
    (globalThis as any).Blob = function () { throw new Error('Creating blobs from ArrayBufferView is not supported'); };
    try {
      const fetchFn = jest.fn(async (u: string) => ({ blob: async () => new RealBlob([u]) })) as any;
      const noFile = jest.fn(async () => { throw new Error('no file system'); });
      const viaData = await blobOfBytes(bytes, 'image/jp2', b64, fetchFn, noFile as any);
      expect(fetchFn).toHaveBeenCalledWith('data:image/jp2;base64,AQID');
      expect(viaData).toBeInstanceOf(RealBlob);
    } finally {
      (globalThis as any).Blob = RealBlob;
    }
  });

  it('on a phone the bytes go through a file of the cache first (the data address is only the last resort)', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const RealBlob = (globalThis as any).Blob;
    (globalThis as any).Blob = function () { throw new Error('Creating blobs from ArrayBufferView is not supported'); };
    try {
      const fetchFn = jest.fn(async (_u: string) => ({ blob: async () => new RealBlob(['abc'], { type: 'image/jpeg' }) })) as any;
      const viaFile = jest.fn(async (b: Uint8Array, m: string, f: any) => (await f('file:///cache/x.bin')).blob());
      const blob = await blobOfBytes(bytes, 'image/jpeg', b64, fetchFn, viaFile as any);
      expect(viaFile).toHaveBeenCalledTimes(1);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(fetchFn).toHaveBeenCalledWith('file:///cache/x.bin');
      expect(blob.size).toBe(3);
    } finally {
      (globalThis as any).Blob = RealBlob;
    }
  });

  it('blobViaTempFile writes the bytes, reads the file back as a blob and deletes the file, also when the read fails', async () => {
    const written: any[] = [];
    const deleted: string[] = [];
    jest.doMock('expo-file-system', () => ({
      Paths: { cache: 'cache' },
      File: function File(this: any, _dir: string, name: string) {
        this.uri = `file:///cache/${name}`;
        this.exists = false;
        this.create = () => { this.exists = true; };
        this.write = (b: any) => written.push(b);
        this.delete = () => deleted.push(this.uri);
      },
    }));
    jest.resetModules();
    const { blobViaTempFile } = require('../../kit8/files/common/identificationPhoto');
    const RealBlob = (globalThis as any).Blob;
    const ok = jest.fn(async () => ({ blob: async () => new RealBlob(['xyz'], { type: 'image/jpeg' }) })) as any;
    const blob = await blobViaTempFile(new Uint8Array([7, 7, 7]), 'image/jpeg', ok);
    expect(blob.size).toBe(3);
    expect(written).toHaveLength(1);
    expect(deleted).toHaveLength(1);
    const bad = jest.fn(async () => ({ blob: async () => new RealBlob([], { type: 'image/jpeg' }) })) as any;
    await expect(blobViaTempFile(new Uint8Array([7]), 'image/jpeg', bad)).rejects.toThrow('could not be read');
    expect(deleted).toHaveLength(2);
    jest.dontMock('expo-file-system');
  });

  it('uploads to the scope identification with the post guid, named by the post; an empty photo and a failure are answered, never thrown', async () => {
    const upload = jest.fn(async () => ({ ok: true as const, file: { rowGUID: 'f1' } as any }));
    const r = await uploadIdentificationPhoto(POST, { mime: 'image/jpeg', bytes: new Uint8Array([9, 9, 9, 9]) }, b64, upload as any);
    expect(r.ok).toBe(true);
    const [target, file] = upload.mock.calls[0] as any[];
    expect(target).toEqual({ scope: 'identification', guid: POST });
    expect(file).toMatchObject({ name: `${POST}.jpg`, mime: 'image/jpeg', size: 4 });
    expect(await uploadIdentificationPhoto(POST, { mime: 'image/jpeg', bytes: new Uint8Array() }, b64, upload as any)).toMatchObject({ ok: false });
    expect(upload).toHaveBeenCalledTimes(1);
    const boom = jest.fn(async () => { throw new Error('network'); });
    expect(await uploadIdentificationPhoto(POST, { mime: 'image/jpeg', bytes: new Uint8Array([1]) }, b64, boom as any)).toEqual({ ok: false, error: 'network' });
  });
});
