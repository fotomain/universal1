// The photo of a post made with the Add form: the post is written a moment after the form closes, so the upload is tried again.
import { uploadIdentificationPhotoWithRetry } from '../../kit8/files/common/identificationPhoto';

const photo = { mime: 'image/jpeg', bytes: new Uint8Array([1, 2, 3]) };
const toB64 = () => 'AAAA';
const sleep = jest.fn(async () => undefined);
beforeEach(() => sleep.mockClear());

it('the first answer that is ok ends it', async () => {
  const upload = jest.fn().mockResolvedValueOnce({ ok: false, error: 'post not found' }).mockResolvedValueOnce({ ok: false, error: 'post not found' }).mockResolvedValueOnce({ ok: true, data: { file: {} } });
  const r = await uploadIdentificationPhotoWithRetry('g1', photo, toB64, { upload: upload as any, sleep, delayMs: 10 });
  expect(r.ok).toBe(true);
  expect(upload).toHaveBeenCalledTimes(3);
  expect(sleep).toHaveBeenCalledTimes(2);
  expect(upload).toHaveBeenCalledWith('g1', photo, toB64);
});

it('after the last try the last error is returned', async () => {
  const upload = jest.fn().mockResolvedValue({ ok: false, error: 'no permission' });
  const r: any = await uploadIdentificationPhotoWithRetry('g1', photo, toB64, { upload: upload as any, sleep, attempts: 3 });
  expect(r).toEqual({ ok: false, error: 'no permission' });
  expect(upload).toHaveBeenCalledTimes(3);
});
