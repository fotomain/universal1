// What a media post card shows, by the origin of the post.
import { mediaPostRows } from '../../../kit8/ui/components/media/common/mediaPostList';
import { mediaPostCardPicture, mediaPostFabActions, mediaPostOriginKind } from '../../../kit8/ui/components/list/cards/mediapost/mediaPostCardModel';

const post = (rowJSON: any, extra: any = {}) => mediaPostRows([{ rowGUID: 'p', orderInList: 1, rowJSON, ...extra }])[0];

it('the kind of a card follows the origin of the post', () => {
  expect(mediaPostOriginKind(post({ mediaKind: 'video', mediaPostOrigin: 'file:///a.mp4' }))).toBe('recording');
  expect(mediaPostOriginKind(post({ mediaImageUri: 'file:///p.jpg', mediaPostOriginType: 'file' }))).toBe('photo');
  expect(mediaPostOriginKind(post({ dataOriginName: 'youtube', mediaPostOrigin: 'https://youtu.be/dQw4w9WgXcQ' }))).toBe('youtube');
  expect(mediaPostOriginKind(post({ dataOriginName: 'msword' }))).toBe('word');
  expect(mediaPostOriginKind(post({ dataOriginName: 'msexcel' }))).toBe('excel');
  expect(mediaPostOriginKind(post({ dataOriginName: 'pdf' }))).toBe('pdf');
  expect(mediaPostOriginKind(post({ dataOriginName: 'personIDCard' }))).toBe('idCard');
  expect(mediaPostOriginKind(post({ dataOriginName: 'personPassport' }))).toBe('passport');
  expect(mediaPostOriginKind(post({ dataOriginName: 'idreader', mediaPostSubTitle: 'Passport · No. P1' }))).toBe('passport');
  expect(mediaPostOriginKind(post({ dataOriginName: 'idreader', mediaPostSubTitle: 'ID card · No. 1' }))).toBe('idCard');
  expect(mediaPostOriginKind(post({ mediaPostOrigin: 'https://example.com' }))).toBe('link');
  expect(mediaPostOriginKind(post({ mediaPostOrigin: 'https://youtu.be/dQw4w9WgXcQ' }))).toBe('youtube');
  expect(mediaPostOriginKind(post({ fileSourceKind: 'task' }))).toBe('file');
  expect(mediaPostOriginKind(post({}))).toBe('text');
});

it('the picture: the photo, the YouTube thumbnail, else none (the card draws the icon of the origin)', () => {
  expect(mediaPostCardPicture(post({ mediaImageUri: 'file:///p.jpg' }))).toBe('file:///p.jpg');
  expect(mediaPostCardPicture(post({ dataOriginName: 'youtube', mediaPostOrigin: 'https://youtu.be/dQw4w9WgXcQ' }))).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  expect(mediaPostCardPicture(post({ dataOriginName: 'pdf' }))).toBe('');
});

it('a person document is a portrait (isIdCard); the new origin types count', () => {
  expect(post({ dataOriginName: 'personIDCard' }).isIdCard).toBe(true);
  expect(post({ dataOriginName: 'personPassport' }).isIdCard).toBe(true);
  expect(post({ dataOriginName: 'youtube' }).isIdCard).toBe(false);
});

const run = () => ({ play: jest.fn(), openLink: jest.fn(), edit: jest.fn(), createBefore: jest.fn(), createAfter: jest.fn(), duplicate: jest.fn(), moveUp: jest.fn(), moveDown: jest.fn(), remove: jest.fn() });
const all = { canAdd: true, canDelete: true, canOpen: true, canEdit: true, playable: true, hasLink: true };

it('the FAB of a card lists only what the user may do and what fits the post', () => {
  const p = post({ mediaKind: 'video' });
  expect(mediaPostFabActions(p, all, run()).map((a) => a.label)).toEqual(['Play', 'Open link', 'Edit', 'Create Before', 'Create After', 'Copy', 'Move up', 'Move down', 'Delete']);
  expect(mediaPostFabActions(p, { ...all, canAdd: false, canDelete: false, canEdit: false, canOpen: false, playable: false, hasLink: false }, run())).toEqual([]);
  expect(mediaPostFabActions(p, { ...all, canDelete: false, hasLink: false, playable: false }, run()).map((a) => a.label)).not.toContain('Delete');
  const r = run();
  mediaPostFabActions(p, all, r, '#d00').find((a) => a.label === 'Delete')!.onPress();
  expect(r.remove).toHaveBeenCalledTimes(1);
  expect(mediaPostFabActions(p, all, r, '#d00').find((a) => a.label === 'Delete')!.color).toBe('#d00');
});
