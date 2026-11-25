// useEstimationData - the documents and the lines of ONE estimation project, read from the database (estimation_document_table / estimation_line_table) and edited in memory:
// every change recalculates the three sums of every line (model/estimationDocumentModel.recalcLines) and is written after a short pause as a DIFF (only the rows that changed, and the
// deletes). The state is local (the tables are written by this hook only); a second window of the same user sees the change after Reload.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readAllPages } from '../../crud/api/apiUtils';
import { calcDocument, type DocumentCalc } from '../model/estimationCalc';
import { diffRows, newDocumentRow, recalcLines, subtreeGUIDs, type DocumentRow, type ExampleEstimate, type LineRow } from '../model/estimationDocumentModel';
import { ESTIMATION_TABLES, type EstimationDocumentJSON } from '../model/estimationModel';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
const SAVE_DELAY_MS = 600;
const BATCH = 400;

export interface EstimationData {
  loading: boolean;
  error: string;
  saveState: SaveState;
  documents: DocumentRow[];
  documentGUID: string | null;
  document: DocumentRow | null;
  lines: LineRow[];
  calc: DocumentCalc;
  selectDocument: (guid: string | null) => void;
  /** the lines are replaced by `fn(previous)`; the sums are recalculated and the diff is written after a pause */
  changeLines: (fn: (prev: LineRow[]) => LineRow[]) => void;
  /** the document changed (title, norms, index, rates ...): the sums of the lines follow */
  changeDocument: (patch: Partial<EstimationDocumentJSON>) => void;
  createDocument: (row: DocumentRow) => Promise<void>;
  /** an example estimate (its TASKS are made by the caller first: the positions name them by `taskGUID`) becomes a document of the project */
  createFromExample: (ex: Pick<ExampleEstimate, 'doc' | 'lines'>) => Promise<void>;
  deleteDocument: (guid: string) => Promise<void>;
  deleteLines: (guids: string[]) => void;
  reload: () => void;
  flush: () => Promise<void>;
}

const fail = (e: any): string => String(e?.message ?? e);

/** `preferredDocumentGUID`: the estimate to open first (the one opened last); used only while that estimate still exists */
export function useEstimationData(client: any, projectGUID: string | null, preferredDocumentGUID?: string | null): EstimationData {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [documentGUID, setDocumentGUID] = useState<string | null>(null);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [reloadKey, setReloadKey] = useState(0);
  const persistedLines = useRef<LineRow[]>([]);
  const persistedDocs = useRef<DocumentRow[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linesRef = useRef<LineRow[]>([]);
  const docsRef = useRef<DocumentRow[]>([]);
  const preferredRef = useRef<string | null>(null);
  preferredRef.current = preferredDocumentGUID ?? null;
  linesRef.current = lines;
  docsRef.current = documents;

  const document = useMemo(() => documents.find((d) => d.rowGUID === documentGUID) ?? null, [documents, documentGUID]);
  const calc = useMemo(() => calcDocument(lines, document?.rowJSON), [lines, document]);

  // read the documents of the project
  useEffect(() => {
    if (!client || !projectGUID) { setDocuments([]); setDocumentGUID(null); setLines([]); return undefined; }
    let alive = true;
    setLoading(true);
    setError('');
    readAllPages<DocumentRow>((from, to) => client.from(ESTIMATION_TABLES.document.table).select('*').eq('rowOwnerGUID', projectGUID).order('orderInList').order('rowGUID').range(from, to))
      .then((rows) => { if (!alive) return; persistedDocs.current = rows; setDocuments(rows); setDocumentGUID((g) => (g && rows.some((r) => r.rowGUID === g) ? g : (preferredRef.current && rows.some((r) => r.rowGUID === preferredRef.current) ? preferredRef.current : rows[0]?.rowGUID ?? null))); })
      .catch((e) => { if (alive) setError(fail(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [client, projectGUID, reloadKey]);

  // read the lines of the selected document
  useEffect(() => {
    if (!client || !projectGUID || !documentGUID) { setLines([]); persistedLines.current = []; return undefined; }
    let alive = true;
    readAllPages<LineRow>((from, to) => client.from(ESTIMATION_TABLES.line.table).select('*').eq('rowOwnerGUID', projectGUID).eq('rowJSON->>documentGUID', documentGUID).order('orderInList').order('rowGUID').range(from, to))
      .then((rows) => { if (alive) { persistedLines.current = rows; setLines(rows); } })
      .catch((e) => { if (alive) setError(fail(e)); });
    return () => { alive = false; };
  }, [client, projectGUID, documentGUID, reloadKey]);

  const write = useCallback(async (table: string, upserts: any[], deletes: string[]) => {
    for (let i = 0; i < upserts.length; i += BATCH) {
      const { error: e } = await client.from(table).upsert(upserts.slice(i, i + BATCH), { onConflict: 'rowGUID' });
      if (e) throw new Error(fail(e));
    }
    for (let i = 0; i < deletes.length; i += BATCH) {
      const { error: e } = await client.from(table).delete().in('rowGUID', deletes.slice(i, i + BATCH));
      if (e) throw new Error(fail(e));
    }
  }, [client]);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!client) return;
    const dDiff = diffRows(persistedDocs.current, docsRef.current);
    const lDiff = diffRows(persistedLines.current, linesRef.current);
    if (!dDiff.upserts.length && !dDiff.deletes.length && !lDiff.upserts.length && !lDiff.deletes.length) { setSaveState('saved'); return; }
    setSaveState('saving');
    try {
      await write(ESTIMATION_TABLES.document.table, dDiff.upserts, dDiff.deletes);
      persistedDocs.current = docsRef.current;
      await write(ESTIMATION_TABLES.line.table, lDiff.upserts, lDiff.deletes);
      persistedLines.current = linesRef.current;
      setSaveState('saved');
      setError('');
    } catch (e) {
      setSaveState('error');
      setError(fail(e));
    }
  }, [client, write]);

  const schedule = useCallback(() => {
    setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, SAVE_DELAY_MS);
  }, [flush]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const changeLines = useCallback((fn: (prev: LineRow[]) => LineRow[]) => {
    const doc = docsRef.current.find((d) => d.rowGUID === documentGUID)?.rowJSON ?? null;
    const next = recalcLines(fn(linesRef.current), doc).lines;
    linesRef.current = next;
    setLines(next);
    schedule();
  }, [documentGUID, schedule]);

  const changeDocument = useCallback((patch: Partial<EstimationDocumentJSON>) => {
    if (!documentGUID) return;
    const nextDocs = docsRef.current.map((d) => (d.rowGUID === documentGUID ? { ...d, rowJSON: { ...d.rowJSON, ...patch } } : d));
    docsRef.current = nextDocs;
    setDocuments(nextDocs);
    const doc = nextDocs.find((d) => d.rowGUID === documentGUID)!.rowJSON;
    const next = recalcLines(linesRef.current, doc).lines;
    linesRef.current = next;
    setLines(next);
    schedule();
  }, [documentGUID, schedule]);

  const createDocument = useCallback(async (row: DocumentRow) => {
    await flush();
    docsRef.current = [...docsRef.current, row];
    setDocuments(docsRef.current);
    linesRef.current = [];
    persistedLines.current = [];
    setLines([]);
    setDocumentGUID(row.rowGUID);
    await flush();
  }, [flush]);

  const createFromExample = useCallback(async (ex: Pick<ExampleEstimate, 'doc' | 'lines'>) => {
    if (!projectGUID) return;
    await flush();
    const { lines: calculated } = recalcLines(ex.lines, ex.doc.rowJSON);
    docsRef.current = [...docsRef.current, ex.doc];
    setDocuments(docsRef.current);
    linesRef.current = calculated;
    persistedLines.current = [];
    setLines(calculated);
    setDocumentGUID(ex.doc.rowGUID);
    await flush();
  }, [flush, projectGUID]);

  const deleteDocument = useCallback(async (guid: string) => {
    await flush();
    if (!client) return;
    setSaveState('saving');
    try {
      const { error: e1 } = await client.from(ESTIMATION_TABLES.line.table).delete().eq('rowOwnerGUID', projectGUID).eq('rowJSON->>documentGUID', guid);
      if (e1) throw new Error(fail(e1));
      const { error: e2 } = await client.from(ESTIMATION_TABLES.document.table).delete().eq('rowGUID', guid);
      if (e2) throw new Error(fail(e2));
      docsRef.current = docsRef.current.filter((d) => d.rowGUID !== guid);
      persistedDocs.current = docsRef.current;
      setDocuments(docsRef.current);
      if (guid === documentGUID) setDocumentGUID(docsRef.current[0]?.rowGUID ?? null);
      setSaveState('saved');
    } catch (e) { setSaveState('error'); setError(fail(e)); }
  }, [client, flush, projectGUID, documentGUID]);

  const deleteLines = useCallback((guids: string[]) => {
    const all = new Set<string>();
    for (const g of guids) subtreeGUIDs(linesRef.current, g).forEach((x) => all.add(x));
    changeLines((prev) => prev.filter((l) => !all.has(l.rowGUID)));
  }, [changeLines]);

  return {
    loading, error, saveState, documents, documentGUID, document, lines, calc,
    selectDocument: (g) => { void flush().then(() => setDocumentGUID(g)); },
    changeLines, changeDocument, createDocument, createFromExample, deleteDocument, deleteLines,
    reload: () => setReloadKey((k) => k + 1), flush,
  };
}

export { newDocumentRow };
