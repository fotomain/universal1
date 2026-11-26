// Web twin of the media file store: a file of a phone cannot be played by a browser page - a clear message, not the generic video error.
import { DEVICE_FILE_ON_WEB_MESSAGE, resolveMediaUri } from '../../kit8/ui/components/media/common/mediaFileStore.web';

it.each(['file:///data/user/0/app/files/media/kit8video_1.mp4', 'content://media/external/video/1', 'ph://ABC'])('refuses the device file %s with a clear message', async (uri) => {
  await expect(resolveMediaUri(uri)).rejects.toThrow(DEVICE_FILE_ON_WEB_MESSAGE);
});

it('lets web addresses and blob urls through', async () => {
  await expect(resolveMediaUri('https://example.com/a.mp4')).resolves.toBe('https://example.com/a.mp4');
  await expect(resolveMediaUri('blob:http://localhost/abc')).resolves.toBe('blob:http://localhost/abc');
});
