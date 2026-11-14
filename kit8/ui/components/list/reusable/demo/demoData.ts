// ReusableList demo - the columns of a media post as list columns, and the generated rows of the big-list test. Pure.
import type { ReusableTableRow, VisualColumn } from '../../../table/reusable/reusableTableTypes';

export const MEDIA_POSTS_ENTITY = 'mediaPostReusable';

/** media post fields (rowJSON of mediaPostTable): title, description, kind, recorded at, duration */
export const MEDIA_POST_LIST_COLUMNS: VisualColumn[] = [
  { key: 'title', title: 'Title', type: 'text', field: 'mediaPostTitle', listRole: 'title' },
  { key: 'description', title: 'Description', type: 'text', field: 'mediaPostDescription', listRole: 'subtitle' },
  { key: 'kind', title: 'Kind', type: 'select', field: 'mediaKind', listRole: 'badge', editable: false, options: [{ value: 'video', label: 'Video' }, { value: 'audio', label: 'Audio' }] },
  { key: 'recorded', title: 'Recorded', type: 'text', field: 'mediaRecordedAt', listRole: 'meta', editable: false },
  { key: 'seconds', title: 'Seconds', type: 'number', field: 'mediaDurationSec', listRole: 'meta', editable: false, total: false },
];

const WORDS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima'];

/** n rows with ascending orderInList (10 apart): the same shape as media posts, so the same columns show them */
export function generateDemoRows(n: number): ReusableTableRow[] {
  const start = Date.UTC(2026, 0, 1);
  const rows: ReusableTableRow[] = new Array(n);
  for (let i = 0; i < n; i++) {
    rows[i] = {
      rowGUID: `demo-${i}`,
      rowOwnerGUID: 'demo',
      rowParentGUID: 'empty',
      orderInList: (i + 1) * 10,
      rowJSON: {
        mediaPostTitle: `Post ${i + 1} · ${WORDS[i % WORDS.length]}`,
        mediaPostDescription: `${WORDS[(i * 7) % WORDS.length]} ${WORDS[(i * 5 + 3) % WORDS.length]} - generated row number ${i + 1}`,
        mediaKind: i % 3 === 0 ? 'audio' : 'video',
        mediaRecordedAt: new Date(start + i * 60_000).toISOString().slice(0, 16).replace('T', ' '),
        mediaDurationSec: (i * 37) % 600,
      },
    };
  }
  return rows;
}
