/** @jest-environment jsdom */
// The cards of the Media Posts list: ReusableCardMediaPost (three sizes, by origin, local FAB) and MediaPostCardDefault (the compact card the list always had).
import React, { act } from 'react';

jest.mock('../../../kit8/ui/components/fab/fabColors', () => ({ getFabMainColors: () => ({ backgroundColor: '#eee', iconColor: '#111' }), getFabMiniColors: (_c: any, a: any) => ({ backgroundColor: a ?? '#eee', iconColor: '#111' }) }));
jest.mock('react-native-paper', () => {
  const R = require('react');
  const RN = require('react-native');
  const Card: any = ({ children, testID }: any) => R.createElement(RN.View, { testID }, children);
  Card.Content = ({ children }: any) => R.createElement(RN.View, null, children);
  const colors = new Proxy({}, { get: () => '#123456' });
  return {
    Card, Text: ({ children, testID, numberOfLines }: any) => R.createElement('span', { 'data-testid': testID, 'data-lines': numberOfLines }, children), Surface: ({ children }: any) => R.createElement(RN.View, null, children),
    IconButton: ({ icon, onPress, testID }: any) => R.createElement(RN.Pressable, { testID, onPress }, R.createElement(RN.Text, null, icon)), useTheme: () => ({ colors }),
  };
});
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => { const R = require('react'); const { Text } = require('react-native'); return { __esModule: true, default: ({ name }: any) => R.createElement(Text, { 'data-icon': name }, name) }; });
jest.mock('../../../kit8/ui/components/common/FABApp', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: ({ testID, icon, onPress }: any) => R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, icon)) };
});
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ useSelector: (fn: any) => fn({}), useDispatch: () => mockDispatch }));
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => { const R = require('react'); const { Pressable, Text } = require('react-native'); return { PMIconButton: ({ testID, onPress, icon }: any) => R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, icon)) }; });
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react'); const { Pressable, Text, View } = require('react-native');
  const flat = (items: any[]): any[] => items.flatMap((i) => [i, ...(i.submenu ? flat(i.submenu) : [])]);
  return { __esModule: true, PM_MENU_WIDTH: 196, default: ({ testID, items }: any) => R.createElement(View, { testID }, flat(items).map((i: any) => R.createElement(Pressable, { key: i.testID, testID: i.testID, onPress: i.submenu ? undefined : i.onPress }, R.createElement(Text, null, i.label)))) };
});
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));
const mockBuild = jest.fn(() => ({ fileName: 'x.json' }));
const mockExport = jest.fn(async () => 'downloaded');
const mockShare = jest.fn(async () => 'copied');
jest.mock('../../../kit8/ui/components/table/reusable/tableExportActions', () => ({
  buildTableFile: (...a: any[]) => (mockBuild as any)(...a), exportTableFile: (...a: any[]) => (mockExport as any)(...a), shareTableFile: (...a: any[]) => (mockShare as any)(...a),
  TABLE_EXPORT_FORMATS: [{ format: 'json', label: 'to JSON', icon: 'data_object' }, { format: 'pdfFull', label: 'to PDF', icon: 'picture_as_pdf' }],
  tableFileResultMessage: (r: string) => (r === 'copied' ? 'copied to the clipboard' : null),
}));

import ReusableCardMediaPost from '../../../kit8/ui/components/list/cards/mediapost/ReusableCardMediaPost';
import MediaPostCardDefault from '../../../kit8/ui/components/list/cards/mediapost/MediaPostCardDefault';
import PersonDocumentDetailsCard from '../../../kit8/ui/components/list/cards/mediapost/PersonDocumentDetailsCard';
import CardLocalFab from '../../../kit8/ui/components/list/cards/CardLocalFab';
import { FABProvider } from '../../../kit8/providers/FABProvider';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const wait = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

const actions = () => ({ edit: jest.fn(), remove: jest.fn(), duplicate: jest.fn(), createBefore: jest.fn(), createAfter: jest.fn(), moveUp: jest.fn(), moveDown: jest.fn(), makeFirst: jest.fn(), makeLast: jest.fn(), openMenu: jest.fn(), markUsed: jest.fn() });
const stateOf = (a = actions(), over: any = {}) => ({ index: 0, reorderable: false, dragging: false, grip: null, actions: a, canEdit: true, canAdd: true, canDelete: true, canOpen: false, ...over });
const rowOf = (rowJSON: any) => ({ rowGUID: 'p1', rowOwnerGUID: 'u', rowParentGUID: 'empty', orderInList: 5, rowJSON });
const video = { mediaPostTitle: 'My video', mediaKind: 'video', mediaDurationSec: 34, mediaPostOrigin: 'file:///a.mp4', mediaPostDescription: 'A long walk' };
const youtube = { mediaPostTitle: 'Song', dataOriginName: 'youtube', mediaPostOrigin: 'https://youtu.be/dQw4w9WgXcQ', mediaPostDescription: 'From YouTube' };

function mount(node: React.ReactElement) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(node));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); });

describe('ReusableCardMediaPost', () => {
  it.each(['cardSmall', 'cardMedium', 'cardBig'] as const)('%s shows the title, the line of the post and the origin of a recording; the play button plays it', (cardSize) => {
    const onPlay = jest.fn();
    mount(<ReusableCardMediaPost row={rowOf(video)} cardSize={cardSize} state={stateOf()} onPlay={onPlay} />);
    expect(q('media-post-title-p1')!.textContent).toBe('My video');
    expect(q('media-post-subtitle-p1')!.textContent).toMatch(/^Video · 0:34/);
    if (cardSize !== 'cardSmall') expect(q('media-post-origin-p1')!.textContent).toBe('Recording');
    press('media-post-play-p1');
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', uris: ['file:///a.mp4'] }));
  });

  it('the description has more lines on the bigger cards (small 1, medium 4, big 6)', () => {
    const lines = (size: any) => {
      mount(<ReusableCardMediaPost row={rowOf(video)} cardSize={size} state={stateOf()} onPlay={jest.fn()} />);
      const lines = q('media-post-description-p1')!.getAttribute('data-lines');
      act(() => root.unmount()); document.body.innerHTML = '';
      return Number(lines);
    };
    expect([lines('cardSmall'), lines('cardMedium'), lines('cardBig')]).toEqual([1, 4, 6]);
  });

  it('a YouTube post draws the thumbnail, says YouTube and offers Open link (no Play: nothing to play in the app)', async () => {
    mount(<ReusableCardMediaPost row={rowOf(youtube)} cardSize="cardBig" state={stateOf()} onPlay={jest.fn()} />);
    expect(q('media-post-origin-p1')!.textContent).toBe('YouTube');
    expect(q('media-post-play-p1')).toBeNull();
    expect(document.body.innerHTML).toContain('img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    press('media-post-fab-p1-button');
    await wait();
    expect(q('media-post-fab-p1-action-Open link')).not.toBeNull();
    expect(q('media-post-fab-p1-action-Play')).toBeNull();
  });

  it('a person document: the portrait, "ID card" / "Passport" as the origin', () => {
    mount(<ReusableCardMediaPost row={rowOf({ mediaPostTitle: 'Anna', dataOriginName: 'personPassport', mediaPostSubTitle: 'Passport · No. P1' })} cardSize="cardMedium" state={stateOf()} onPlay={jest.fn()} />);
    expect(q('media-post-origin-p1')!.textContent).toBe('Passport');
    expect(q('media-post-subtitle-p1')!.textContent).toBe('Passport · No. P1');
  });

  it('a card with no picture draws the icon of its origin', () => {
    mount(<ReusableCardMediaPost row={rowOf({ mediaPostTitle: 'Doc', dataOriginName: 'pdf' })} cardSize="cardMedium" state={stateOf()} onPlay={jest.fn()} />);
    expect(q('media-post-image-p1')).toBeNull();
    expect(document.body.textContent).toContain('file-pdf-box');
  });

  it('the project of the post is shown on the card', () => {
    mount(<ReusableCardMediaPost row={rowOf({ ...video, fileSourceKind: 'task' })} cardSize="cardSmall" state={stateOf()} project={{ name: 'Railway #1', readonly: true }} onPlay={jest.fn()} />);
    expect(q('media-post-project-p1')!.textContent).toBe('Project: Railway #1 (read-only)');
  });

  it('the local FAB opens the actions of THIS card; an action runs the command of the row and closes the FAB', async () => {
    const a = actions();
    mount(<ReusableCardMediaPost row={rowOf(video)} cardSize="cardMedium" state={stateOf(a)} onPlay={jest.fn()} />);
    expect(q('media-post-fab-p1-action-Delete')).toBeNull();
    press('media-post-fab-p1-button');
    await wait();
    ['Play', 'Create Before', 'Create After', 'Copy', 'Move up', 'Move down', 'Delete'].forEach((l) => expect(q(`media-post-fab-p1-action-${l}`)).not.toBeNull());
    press('media-post-fab-p1-action-Delete');
    expect(a.remove).toHaveBeenCalledWith('p1');
    expect(q('media-post-fab-p1-action-Delete')).toBeNull();
    press('media-post-fab-p1-button');
    await wait();
    press('media-post-fab-p1-action-Create After');
    expect(a.createAfter).toHaveBeenCalledWith('p1');
  });

  it('read only: no Delete / Create / Copy / Move in the FAB; nothing to do = no FAB at all', async () => {
    mount(<ReusableCardMediaPost row={rowOf(video)} cardSize="cardSmall" state={stateOf(actions(), { canEdit: false, canAdd: false, canDelete: false })} onPlay={jest.fn()} />);
    press('media-post-fab-p1-button');
    await wait();
    expect(q('media-post-fab-p1-action-Play')).not.toBeNull();
    expect(q('media-post-fab-p1-action-Delete')).toBeNull();
    expect(q('media-post-fab-p1-action-Copy')).toBeNull();
    act(() => root.unmount()); document.body.innerHTML = '';
    mount(<ReusableCardMediaPost row={rowOf({ mediaPostTitle: 'Note' })} cardSize="cardSmall" state={stateOf(actions(), { canEdit: false, canAdd: false, canDelete: false })} onPlay={jest.fn()} />);
    expect(q('media-post-fab-p1')).toBeNull();
  });

  it('puts the grip of the list into the card', () => {
    mount(<ReusableCardMediaPost row={rowOf(video)} cardSize="cardSmall" state={stateOf(actions(), { grip: <div data-testid="the-grip" /> })} onPlay={jest.fn()} />);
    expect(q('the-grip')).not.toBeNull();
  });
});

describe('the last used card', () => {
  it('a press on the card and Play mark it as used (the toolbar button scrolls to it)', () => {
    const a = actions();
    mount(<ReusableCardMediaPost row={rowOf(video)} cardSize="cardSmall" state={stateOf(a)} onPlay={jest.fn()} />);
    press('media-post-p1-press');
    expect(a.markUsed).toHaveBeenCalledWith('p1');
    a.markUsed.mockClear();
    press('media-post-play-p1');
    expect(a.markUsed).toHaveBeenCalledWith('p1');
  });
});

describe('MediaPostCardDefault (as the list was)', () => {
  it('title, play and delete; Delete asks the list; the project name; no Delete when the user may not delete', () => {
    const a = actions();
    const onPlay = jest.fn();
    mount(<MediaPostCardDefault row={rowOf(video)} cardSize="cardSmall" state={stateOf(a)} project={{ name: 'Railway #1', readonly: false }} onPlay={onPlay} />);
    expect(q('media-post-title-p1')!.textContent).toBe('My video');
    expect(q('media-post-project-p1')!.textContent).toBe('Project: Railway #1');
    press('media-post-play-p1');
    expect(onPlay).toHaveBeenCalledTimes(1);
    press('media-post-delete-p1');
    expect(a.remove).toHaveBeenCalledWith('p1');
    act(() => root.unmount()); document.body.innerHTML = '';
    mount(<MediaPostCardDefault row={rowOf({ mediaPostTitle: 'A web page', mediaPostOrigin: 'https://example.com' })} cardSize="cardSmall" state={stateOf(actions(), { canDelete: false })} onPlay={onPlay} />);
    expect(q('media-post-play-p1')).toBeNull();
    expect(q('media-post-delete-p1')).toBeNull();
  });
});

// the web list has no backdrop: a pointer press anywhere else closes it and still reaches its target
const pointerDownOn = (el: Element) => act(() => { el.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
const pointerDownOutside = () => pointerDownOn(document.body);

describe('CardLocalFab', () => {
  it('ONE press on the FAB of another card opens it while this one is open (the first press is not spent on closing)', async () => {
    const a = [{ icon: 'play', label: 'Play', onPress: jest.fn() }];
    mount(<FABProvider><CardLocalFab id="a" actions={a} /><CardLocalFab id="b" actions={a} /></FABProvider>);
    press('card-fab-a-button');
    await wait();
    expect(q('card-fab-a-action-Play')).not.toBeNull();
    // what a real mouse does: pointerdown, then click on the other FAB
    pointerDownOn(q('card-fab-b-button')!);
    press('card-fab-b-button');
    await wait();
    expect(q('card-fab-b-action-Play')).not.toBeNull();
    expect(q('card-fab-a-action-Play')).toBeNull();
  });
  it('a press on its own button closes the list (it is not closed and reopened)', async () => {
    mount(<FABProvider><CardLocalFab id="a" actions={[{ icon: 'play', label: 'Play', onPress: jest.fn() }]} /></FABProvider>);
    press('card-fab-a-button');
    await wait();
    pointerDownOn(q('card-fab-a-button')!);
    press('card-fab-a-button');
    await wait();
    expect(q('card-fab-a-action-Play')).toBeNull();
  });
  it('opens a list of the actions with their names and closes it by the backdrop', async () => {
    const run = jest.fn();
    mount(<CardLocalFab id="x" actions={[{ icon: 'play', label: 'Play', onPress: run }, { icon: 'delete-outline', label: 'Delete', onPress: jest.fn() }]} />);
    press('card-fab-x-button');
    await wait();
    expect(q('card-fab-x-action-Play')).not.toBeNull();
    pointerDownOutside();
    expect(q('card-fab-x-action-Play')).toBeNull();
    press('card-fab-x-button');
    await wait();
    press('card-fab-x-action-Play');
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('double click / double touch on the card of a person document', () => {
  const idPost = { mediaPostTitle: 'JURIJS TERENTJEVS', dataOriginName: 'idreader', mediaPostSubTitle: 'ID card · No. PA3626350', idCardOwnerName: 'JURIJS TERENTJEVS', idCardNumber: 'PA3626350', idCardKind: 'ID card', mediaImageUri: 'data:image/jpeg;base64,AAAA', idCardFields: [{ label: 'Surname', value: 'TERENTJEVS' }, { label: 'Sex', value: 'M' }] };

  it.each(['cardSmall', 'cardMedium', 'cardBig'] as const)('%s: two presses open the details; one press does not', async (cardSize) => {
    const onOpenDetails = jest.fn();
    mount(<ReusableCardMediaPost row={rowOf(idPost)} cardSize={cardSize} state={stateOf()} onPlay={jest.fn()} onOpenDetails={onOpenDetails} />);
    press('media-post-p1-press');
    await wait(450);
    expect(onOpenDetails).not.toHaveBeenCalled();
    press('media-post-p1-press');
    press('media-post-p1-press');
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
    expect(onOpenDetails).toHaveBeenCalledWith(expect.objectContaining({ rowGUID: 'p1' }));
  });

  it('a card that is no person document ignores the double press', () => {
    const onOpenDetails = jest.fn();
    mount(<ReusableCardMediaPost row={rowOf(video)} cardSize="cardSmall" state={stateOf()} onPlay={jest.fn()} onOpenDetails={onOpenDetails} />);
    press('media-post-p1-press');
    press('media-post-p1-press');
    expect(onOpenDetails).not.toHaveBeenCalled();
  });

  it('the default card opens the details too', () => {
    const onOpenDetails = jest.fn();
    mount(<MediaPostCardDefault row={rowOf(idPost)} cardSize="cardSmall" state={stateOf()} onPlay={jest.fn()} onOpenDetails={onOpenDetails} />);
    press('media-post-press-p1');
    press('media-post-press-p1');
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });
});

describe('PersonDocumentDetailsCard (read only)', () => {
  const row = rowOf({ dataOriginName: 'idreader', idCardOwnerName: 'JURIJS TERENTJEVS', idCardNumber: 'PA3626350', idCardKind: 'ID card', mediaImageUri: `data:image/jpeg;base64,${require('fs').readFileSync(require('path').join(__dirname, '../../media/fixtures/face_30x40.jpg')).toString('base64')}`, idCardFields: [{ label: 'Surname', value: 'TERENTJEVS' }, { label: 'Date of birth', value: '02.10.1970' }] });

  it('shows the photo, the name, the document and every datum; nothing can be typed; Close and the backdrop close it', () => {
    const onClose = jest.fn();
    mount(<PersonDocumentDetailsCard row={row} onClose={onClose} />);
    expect(q('person-document-name')!.textContent).toBe('JURIJS TERENTJEVS');
    expect(q('person-document-kind')!.textContent).toBe('ID card · No. PA3626350');
    expect(document.body.innerHTML).toContain('data:image/jpeg;base64,/9j/');
    expect(q('person-document-field-0')!.textContent).toContain('Surname');
    expect(q('person-document-field-1')!.textContent).toContain('02.10.1970');
    expect(document.querySelectorAll('input, textarea').length).toBe(0);
    press('person-document-close');
    press('person-document-backdrop');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Close is at the LEFT of the top row, the three dots menu at the RIGHT', () => {
    mount(<PersonDocumentDetailsCard row={row} onClose={jest.fn()} />);
    const top = q('person-document-close')!.parentElement!;
    const order = Array.from(top.children).map((c) => c.querySelector('[data-testid]')?.getAttribute('data-testid') ?? c.getAttribute('data-testid'));
    expect(order[0]).toBe('person-document-close');
    expect(order[order.length - 1]).toBe('person-document-more');
  });

  it('the three dots menu exports and shares ALL the data: name, document, number and every datum, one row each', async () => {
    mount(<PersonDocumentDetailsCard row={row} onClose={jest.fn()} />);
    press('person-document-more');
    await wait();
    press('person-document-menu-export-json');
    await wait(5);
    const [format, src] = (mockBuild.mock.calls[0] as any[]);
    expect(format).toBe('json');
    expect(src.title).toBe('JURIJS TERENTJEVS ID card');
    expect(src.rows.map((r: any) => [r.rowJSON.label, r.rowJSON.value])).toEqual([
      ['Name', 'JURIJS TERENTJEVS'], ['Document', 'ID card'], ['Document number', 'PA3626350'], ['Surname', 'TERENTJEVS'], ['Date of birth', '02.10.1970'],
      ['Photo (base64 image/jpeg)', expect.stringMatching(/^\/9j\//)],
    ]);
    // plain base64: no "data:" start, it is the LAST field
    const last = src.rows[src.rows.length - 1].rowJSON.value as string;
    expect(last.startsWith('data:')).toBe(false);
    expect(Buffer.from(last, 'base64')[0]).toBe(0xff);
    expect(mockExport).toHaveBeenCalledTimes(1);
    press('person-document-more');
    await wait();
    press('person-document-menu-share-pdfFull');
    await wait(5);
    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'snackbar', p: { message: 'copied to the clipboard' } });
  });

  it('the PDF is the page of the document WITH the owner photo (one PDF entry, not two)', async () => {
    mount(<PersonDocumentDetailsCard row={row} onClose={jest.fn()} />);
    press('person-document-more');
    await wait();
    expect(q('person-document-menu-export-pdfVisible')).toBeNull();
    expect(q('person-document-menu-export-pdfFull')!.textContent).toBe('to PDF (with photo)');
    mockBuild.mockClear(); mockExport.mockClear();
    press('person-document-menu-export-pdfFull');
    await wait(5);
    expect(mockBuild).not.toHaveBeenCalled();
    const file: any = (mockExport.mock.calls[0] as any[])[0];
    expect(file).toMatchObject({ mimeType: 'application/pdf' });
    expect(file.fileName).toMatch(/\.pdf$/);
    expect(Buffer.from(file.bytes).toString('latin1')).toContain('/Subtype /Image');
  });
});
