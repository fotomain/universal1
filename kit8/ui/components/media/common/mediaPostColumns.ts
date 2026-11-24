// The columns (the SCHEMA) of the Media Posts list of ReusableList: what the search looks in and what the Sort and Filter menu offers. The card draws the post itself.
import type { VisualColumn } from '../../table/reusable/reusableTableTypes';

export const MEDIA_POST_COLUMNS: VisualColumn[] = [
  { key: 'title', title: 'Title', type: 'text', field: 'mediaPostTitle', listRole: 'title' },
  { key: 'description', title: 'Description', type: 'text', field: 'mediaPostDescription', listRole: 'subtitle' },
  { key: 'subtitle', title: 'Sub title', type: 'text', field: 'mediaPostSubTitle', listRole: 'meta' },
  { key: 'origin', title: 'Origin', type: 'text', field: 'dataOriginName', listRole: 'badge', editable: false },
  { key: 'kind', title: 'Kind', type: 'select', field: 'mediaKind', listRole: 'hidden', editable: false, options: [{ value: 'video', label: 'Video' }, { value: 'audio', label: 'Audio' }] },
  { key: 'recorded', title: 'Recorded', type: 'text', field: 'mediaRecordedAt', listRole: 'meta', editable: false },
];
