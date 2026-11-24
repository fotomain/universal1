// The owner photo of a typed in person document.
import { isPictureItem, personPhotoOf, pickPersonPhoto } from '../../../kit8/ui/components/list/forms/personPhoto';

it('only a picture is accepted', () => {
  expect(isPictureItem({ name: 'a.jpg', mimeType: '' })).toBe(true);
  expect(isPictureItem({ name: 'scan', mimeType: 'image/png' })).toBe(true);
  expect(isPictureItem({ name: 'a.PDF', mimeType: 'application/pdf' })).toBe(false);
});

it('a file that is no picture is refused with words, before any work', async () => {
  await expect(personPhotoOf({ name: 'a.pdf', mimeType: 'application/pdf', uri: 'file:///a.pdf' })).rejects.toThrow('Choose a picture');
});

it('nothing picked = null; the picker is asked for pictures only, one file', async () => {
  const pick = jest.fn(async () => []);
  expect(await pickPersonPhoto(pick as any)).toBeNull();
  expect(pick).toHaveBeenCalledWith({ accept: 'image/*', mimeTypes: ['image/*'], multiple: false });
});

it('a picture on a phone is made a small JPEG by the image manipulator', async () => {
  jest.doMock('expo-image-manipulator', () => ({ SaveFormat: { JPEG: 'jpeg' }, manipulateAsync: jest.fn(async () => ({ base64: '/9j/XYZ' })) }));
  const { personPhotoOf: of } = require('../../../kit8/ui/components/list/forms/personPhoto');
  const photo = await of({ name: 'me.heic', mimeType: 'image/heic', uri: 'file:///me.heic' });
  expect(photo).toEqual({ dataUri: 'data:image/jpeg;base64,/9j/XYZ', mime: 'image/jpeg', base64: '/9j/XYZ' });
  const m = require('expo-image-manipulator').manipulateAsync;
  expect(m).toHaveBeenCalledWith('file:///me.heic', [{ resize: { width: 480 } }], expect.objectContaining({ base64: true, format: 'jpeg' }));
});
