// Where a recording plays from: phone = its own file first, then the storage; web = the storage first, then the copy of this browser.
import { driveFileOfPart, resolvePlaySource, type PlaySourceDeps } from '../../kit8/ui/components/media/play/playSource';

const deps = (over: Partial<PlaySourceDeps> = {}): PlaySourceDeps => ({
  isWeb: false,
  resolveLocal: jest.fn(async (u: string) => (u.startsWith('kit8media://') ? 'blob:local' : u)),
  localExists: jest.fn(async () => true),
  driveUrl: jest.fn(async (id: string) => `https://fn/?file=${id}`),
  ...over,
});
const DRIVE = { fileRowGUID: 'f1', googleDriveURLToFile: 'https://drive.google.com/file/d/X/view' };

it('no file in the storage: plays the own address, as before', async () => {
  const d = deps();
  expect(await resolvePlaySource('kit8media://a.webm', undefined, d)).toEqual({ uri: 'blob:local', from: 'local' });
  expect(await resolvePlaySource('https://x/a.mp4', undefined, deps({ isWeb: true }))).toEqual({ uri: 'https://x/a.mp4', from: 'local' });
  expect(d.driveUrl).not.toHaveBeenCalled();
});

it('PHONE: the file of the device first while it exists', async () => {
  const d = deps();
  expect(await resolvePlaySource('file:///a.mp4', DRIVE, d)).toEqual({ uri: 'file:///a.mp4', from: 'local' });
  expect(d.driveUrl).not.toHaveBeenCalled();
});

it('PHONE: the file is gone -> the file in the storage', async () => {
  const d = deps({ localExists: jest.fn(async () => false) });
  expect(await resolvePlaySource('file:///a.mp4', DRIVE, d)).toEqual({ uri: 'https://fn/?file=f1', from: 'drive' });
  // a post with no local address at all
  expect((await resolvePlaySource('', DRIVE, deps())).from).toBe('drive');
});

it('PHONE: the file did not play -> forceDrive goes straight to the storage', async () => {
  const d = deps();
  expect((await resolvePlaySource('file:///a.mp4', DRIVE, d, { forceDrive: true })).from).toBe('drive');
  expect(d.localExists).not.toHaveBeenCalled();
});

it('WEB: the file in the storage first, even when this browser has a copy', async () => {
  const d = deps({ isWeb: true });
  expect(await resolvePlaySource('kit8media://a.webm', DRIVE, d)).toEqual({ uri: 'https://fn/?file=f1', from: 'drive' });
  expect(d.resolveLocal).not.toHaveBeenCalled();
});

it('WEB: the storage cannot be reached -> the copy of this browser; no copy either -> the storage error', async () => {
  const down = jest.fn(async () => { throw new Error('storage down'); });
  expect(await resolvePlaySource('kit8media://a.webm', DRIVE, deps({ isWeb: true, driveUrl: down }))).toEqual({ uri: 'blob:local', from: 'local' });
  const gone = jest.fn(async () => { throw new Error('no copy'); });
  await expect(resolvePlaySource('file:///phone.mp4', DRIVE, deps({ isWeb: true, driveUrl: down, resolveLocal: gone }))).rejects.toThrow('storage down');
});

it('driveFileOfPart takes the part by position', () => {
  expect(driveFileOfPart([DRIVE], 0)).toBe(DRIVE);
  expect(driveFileOfPart([DRIVE], 1)).toBeUndefined();
  expect(driveFileOfPart(undefined, 0)).toBeUndefined();
  expect(driveFileOfPart([{ fileRowGUID: '', googleDriveURLToFile: '' }], 0)).toBeUndefined();
});
