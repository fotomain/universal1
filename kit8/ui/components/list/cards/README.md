# List cards (`kit8/ui/components/list/cards`)

Cards for `ReusableList` (iOS, Android, web) and the older web cards (`CardBasicVersion`, `CardFullVersion` - browser tags, web only).

| File | What |
|---|---|
| `cardSize.ts` | `cardSmall` / `cardMedium` / `cardBig`: item heights 96 / 192 / 400 px (medium = twice small), `CARD_GAP` 8 px, `normalizeCardSize` |
| `SelectCardSizeIconButton.tsx` | the toolbar icon button + menu of the three sizes (the toolbar of ReusableList shows it when the list gets `cardSize`) |
| `CardLocalFab.tsx` | the local FAB of ONE card: a small round button, opens the actions of that card as mini buttons with names; works on web AND phone (`FABForCardComponent` uses a browser portal + `<div>`: web only); one FAB open at a time through `FABProvider` (alone without it) |
| `reusableCardTypes.ts` | `ReusableCardProps` (row, cardSize, state of the list) |
| `youtubeThumbnail.ts` | `extractYouTubeId`, `getYouTubeThumbnail` (shared with the web card) |
| `mediapost/ReusableCardMediaPost.tsx` | the media post card in three sizes, adapts to the ORIGIN of the post |
| `mediapost/MediaPostCardDefault.tsx` | the compact card the Media Posts list always had (one size) = the card while no `reusableCard` is given |
| `mediapost/PersonDocumentDetailsCard.tsx` | READ ONLY details of a person's ID card / passport (photo, name, document, every datum; top row = Close at the LEFT, three dots menu at the RIGHT = Export all / Share all: JSON and CSV = a Field / Value table with the owner photo as plain base64 in the LAST row; PDF = one page with the photo, `personDocumentPdf.ts`); opens on a **double click / double touch** of the card (`useDoubleTapOpen`, 380 ms; `MediaPostsNativeList` holds it); data: `personDocumentModel.ts` (the reader's `idCardFields` or the fields of a post typed in with the Add form) |
| `mediapost/mediaPostCardModel.ts` | pure: origin kind, picture, lines per size, the actions of the FAB |

## ReusableCardMediaPost
- **cardSmall**: small picture / icon, title, line of the post, one line of the description, FAB at the right. **cardMedium** (twice the height): bigger picture, 2-line title, origin badge, 4 lines. **cardBig**: wide picture on top (play button over it), whole title, up to 6 lines, origin badge + FAB at the bottom. The cards are FIXED height (FlashList recycles cells, the drag reorder is index math).
- **Origin** (`dataOriginName` + the post): recording (Play = `MediaPlayerModal`, the player of Drawer -> Play), photo, YouTube (thumbnail of the link, Open link), web page / PDF / Word / Excel / HTML / text (icon of the origin), ID card / passport (`personIDCard`, `personPassport`, the reader's `idreader`: portrait drawn contained), file of the Files tab, link.
- **FAB actions** (only what the user may do and what fits the post): Play · Open link · Edit · Create Before · Create After · Copy · Move up · Move down · Delete - they call `state.actions` of the list.
- Used by `MediaPostsNativeList` (`reusableCard` prop; `app/posts/mediapostcrud/index.native.tsx` passes it). The chosen size is kept on the device (AsyncStorage `mediaPostsCardSize`).

Tests: `__tests__/ui/list` (`cardSize`, `mediaPostCardModel`, `mediaPostCards`), `__tests__/media/mediaPostsNativeList.test.tsx`.
