// linePlaceModel - the "place" of a line of a MULTI PROJECT vendor invoice / purchase order: its project, its task (vendorInvoiceTaskGUID / purchaseOrderTaskGUID) and its task line
// (vendorInvoiceTaskLineGUID / purchaseOrderTaskLineGUID). Pure and shared by both documents (the SQL RPCs *_set_line_task and *_line_places return / take these).
export interface LinePlace {
  projectGUID: string;
  projectName: string;
  taskGUID: string;
  taskName: string;
  taskLineGUID: string | null;
}

/** which of the two fields of the line: the task or the task line */
export type PlaceField = 'task' | 'taskLine';

export function parseLinePlaces(data: any): Record<string, LinePlace> {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const out: Record<string, LinePlace> = {};
  for (const [line, v] of Object.entries<any>(d)) {
    out[line] = {
      projectGUID: String(v?.projectGUID ?? ''),
      projectName: String(v?.projectName ?? ''),
      taskGUID: String(v?.taskGUID ?? ''),
      taskName: String(v?.taskName ?? ''),
      taskLineGUID: v?.taskLineGUID ? String(v.taskLineGUID) : null,
    };
  }
  return out;
}

const UUID = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
/** the first GUID in a text (the clipboard: "Copy GUID" of a task / "Copy line GUID" of a Finances line; a pasted sentence or a link with a GUID works too), lower case; null when there is none */
export function extractGUID(text: string | null | undefined): string | null {
  const m = String(text ?? '').match(UUID);
  return m ? m[0].toLowerCase() : null;
}

/**
 * What a field change asks the database for (the RPC *_set_line_task(line, task, task line)):
 *   task:      only the task (its project follows; the line becomes an independent line of that task)
 *   taskLine:  the task line (its task and project follow)
 *   clear:     both null = back to the task and the project of the document, without a task line
 */
export function placeChange(field: PlaceField, guid: string | null): { task: string | null; taskLine: string | null } {
  if (!guid) return { task: null, taskLine: null };
  return field === 'task' ? { task: guid, taskLine: null } : { task: null, taskLine: guid };
}

/** the key that changes when a line moved: the places are read again */
export function placesSignature(rows: { rowGUID: string; rowProjectGUID?: string; rowOwnerGUID?: string; taskLineGUID?: string | null }[] | null | undefined): string {
  return (rows ?? []).map((r) => `${r.rowGUID}:${r.rowProjectGUID ?? ''}:${r.rowOwnerGUID ?? ''}:${r.taskLineGUID ?? ''}`).sort().join('|');
}

/** the text of a place cell */
export function placeCellText(field: PlaceField, place: LinePlace | undefined): { main: string; sub: string } {
  if (!place) return { main: '', sub: '' };
  return field === 'task'
    ? { main: place.taskName || place.taskGUID, sub: place.taskGUID }
    : { main: place.taskLineGUID ? place.taskLineGUID : '', sub: '' };
}
