// What a media post card shows, by the ORIGIN of the post. Pure: no React, no redux.
// One post = one row of mediaPostReusable (rowJSON.dataOriginName tells where the post comes from).
import type { MediaPostRow } from '../../../media/common/mediaPostList';
import { extractYouTubeId, getYouTubeThumbnail } from '../youtubeThumbnail';
import type { CardSize } from '../cardSize';
import type { CardFabAction } from '../CardLocalFab';

export type MediaPostCardOrigin = 'recording' | 'photo' | 'youtube' | 'webpage' | 'pdf' | 'word' | 'excel' | 'html' | 'text' | 'idCard' | 'passport' | 'file' | 'link';

/** MaterialCommunityIcons name of the picture place of a card that has no picture */
export const ORIGIN_ICON: Record<MediaPostCardOrigin, string> = {
  recording: 'video', photo: 'image', youtube: 'youtube', webpage: 'web', pdf: 'file-pdf-box', word: 'file-word', excel: 'file-excel', html: 'language-html5',
  text: 'text-box', idCard: 'card-account-details', passport: 'passport', file: 'file', link: 'link-variant',
};
export const ORIGIN_NAME: Record<MediaPostCardOrigin, string> = {
  recording: 'Recording', photo: 'Photo', youtube: 'YouTube', webpage: 'Web page', pdf: 'PDF', word: 'Word', excel: 'Excel', html: 'HTML', text: 'Text',
  idCard: 'ID card', passport: 'Passport', file: 'File', link: 'Link',
};

export function mediaPostOriginKind(post: MediaPostRow): MediaPostCardOrigin {
  switch (post.originName) {
    case 'youtube': return 'youtube';
    case 'webpage': return 'webpage';
    case 'pdf': return 'pdf';
    case 'msword': return 'word';
    case 'msexcel': return 'excel';
    case 'html': return 'html';
    case 'text': return 'text';
    case 'personPassport': return 'passport';
    case 'personIDCard': case 'idreader': return /passport/i.test(post.subtitle) ? 'passport' : 'idCard';
    default: break;
  }
  if (post.kind) return 'recording';
  if (post.imageUri) return 'photo';
  if (post.isFileRow) return 'file';
  if (post.originUrl) return extractYouTubeId(post.originUrl) ? 'youtube' : 'link';
  return 'text';
}

/** the picture of a card: a photo / the owner photo of a document, the thumbnail of a YouTube video, else '' (the card draws the icon of the origin) */
export function mediaPostCardPicture(post: MediaPostRow): string {
  if (post.imageUri) return post.imageUri;
  if (mediaPostOriginKind(post) === 'youtube') return getYouTubeThumbnail(post.originUrl, 'hq') ?? '';
  return '';
}

/** how many lines of the description fit a card of this size */
export const DESCRIPTION_LINES: Record<CardSize, number> = { cardSmall: 1, cardMedium: 4, cardBig: 6 };
/** the width of the picture of the small and the medium card (the big card has the picture on top, full width) */
export const PICTURE_WIDTH: Record<CardSize, number> = { cardSmall: 72, cardMedium: 128, cardBig: 0 };
/** the picture of a card of a person document is a portrait: it is drawn contained, not cropped */
export const pictureResizeMode = (post: MediaPostRow): 'contain' | 'cover' => (post.isIdCard ? 'contain' : 'cover');

export interface MediaPostCardRights { canAdd: boolean; canDelete: boolean; canOpen: boolean; canEdit: boolean; playable: boolean; hasLink: boolean }

/** the actions of the local FAB of a card: only those the user may run and that make sense for the post */
export function mediaPostFabActions(post: MediaPostRow, rights: MediaPostCardRights, run: {
  play: () => void; openLink: () => void; edit: () => void; createBefore: () => void; createAfter: () => void; duplicate: () => void; moveUp: () => void; moveDown: () => void; remove: () => void;
}, dangerColor?: string): CardFabAction[] {
  const out: CardFabAction[] = [];
  if (rights.playable) out.push({ icon: 'play', label: 'Play', onPress: run.play });
  if (rights.hasLink) out.push({ icon: 'open-in-new', label: 'Open link', onPress: run.openLink });
  if (rights.canOpen) out.push({ icon: 'pencil-outline', label: 'Edit', onPress: run.edit });
  if (rights.canAdd) {
    out.push({ icon: 'table-row-plus-before', label: 'Create Before', onPress: run.createBefore });
    out.push({ icon: 'table-row-plus-after', label: 'Create After', onPress: run.createAfter });
    out.push({ icon: 'content-copy', label: 'Copy', onPress: run.duplicate });
  }
  if (rights.canEdit) {
    out.push({ icon: 'arrow-up', label: 'Move up', onPress: run.moveUp });
    out.push({ icon: 'arrow-down', label: 'Move down', onPress: run.moveDown });
  }
  if (rights.canDelete) out.push({ icon: 'delete-outline', label: 'Delete', onPress: run.remove, color: dangerColor });
  return out;
}
