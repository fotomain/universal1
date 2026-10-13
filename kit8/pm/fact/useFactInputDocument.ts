// useFactInputDocument - the data of the screen PMFactInputDocument: the documents of a task, the selected one (the latest DRAFT unless told which) and its lines,
// with the commands (new document, post, unpost, save a line, add a line, delete a line, delete the document). React Query holds the rows; every command re-reads what it changed,
// because the database computes the sums, the day grain and the document number.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../providers/WithSupabase';
import {
  createFactDocument, deleteFactDocument, deleteFactLine, fetchFactDocuments, fetchFactLines, fetchTaskInfo, insertFactLine, postFactDocument, unpostFactDocument, updateFactLine,
} from './factInputApi';
import { FactHeaderRow, FactHeaderView, FactLineRow, FactPostAnswer, factHeaderOf, latestDraft } from './factInputModel';

export const factDocumentsKey = (taskGUID: string) => ['pm', 'factDocuments', taskGUID] as const;
export const factLinesKey = (headerGUID: string | null | undefined) => ['pm', 'factLines', headerGUID] as const;
export const factTaskKey = (taskGUID: string) => ['pm', 'factTask', taskGUID] as const;

const NO_ROWS: never[] = [];

export interface UseFactInputDocument {
  taskName: string;
  projectGUID: string | null;
  documents: FactHeaderRow[];
  header: FactHeaderView | null;
  lines: FactLineRow[];
  isLoading: boolean;
  error: string | null;
  busy: boolean;
  select: (headerGUID: string) => void;
  newDocument: () => Promise<string | null>;
  post: () => Promise<FactPostAnswer | null>;
  unpost: () => Promise<FactPostAnswer | null>;
  saveLine: (lineGUID: string, patch: Parameters<typeof updateFactLine>[2]) => Promise<boolean>;
  addLine: (line: Parameters<typeof insertFactLine>[1]) => Promise<boolean>;
  removeLine: (lineGUID: string) => Promise<boolean>;
  removeDocument: () => Promise<boolean>;
  refetch: () => void;
}

export function useFactInputDocument(taskGUID: string, documentGUID?: string | null): UseFactInputDocument {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string | null>(documentGUID ?? null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const autoCreated = useRef(false);

  const taskQ = useQuery({ queryKey: factTaskKey(taskGUID), enabled: !!taskGUID, staleTime: 60_000, queryFn: () => fetchTaskInfo(supabase, taskGUID) });
  const docsQ = useQuery({ queryKey: factDocumentsKey(taskGUID), enabled: !!taskGUID, staleTime: 5_000, queryFn: () => fetchFactDocuments(supabase, taskGUID) });
  const documents = docsQ.data ?? (NO_ROWS as FactHeaderRow[]);

  // the document shown: the one picked / asked for, else the latest draft, else the newest
  const headerRow = useMemo(
    () => documents.find((d) => d.rowGUID === picked) ?? latestDraft(documents) ?? documents[0],
    [documents, picked],
  );
  const header = useMemo(() => (headerRow ? factHeaderOf(headerRow) : null), [headerRow]);
  const linesQ = useQuery({ queryKey: factLinesKey(header?.guid), enabled: !!header?.guid, staleTime: 5_000, queryFn: () => fetchFactLines(supabase, header!.guid) });
  const lines = linesQ.data ?? (NO_ROWS as FactLineRow[]);

  const refetchDocuments = useCallback(() => qc.invalidateQueries({ queryKey: factDocumentsKey(taskGUID) }), [qc, taskGUID]);
  const refetchLines = useCallback((h: string) => qc.invalidateQueries({ queryKey: factLinesKey(h) }), [qc]);

  /** runs a command: busy while it runs, the message of the database on a failure (null result) */
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setActionError(null);
    try {
      return await fn();
    } catch (e: any) {
      setActionError(e?.message || String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const newDocument = useCallback(async () => {
    const guid = await run(async () => {
      const g = await createFactDocument(supabase, taskGUID);
      await qc.invalidateQueries({ queryKey: factDocumentsKey(taskGUID) });
      return g;
    });
    if (guid) setPicked(guid);
    return guid;
  }, [run, supabase, taskGUID, qc]);

  // no document at all (or none of them a draft and none asked for): the first open makes a draft with the lines of the task - once; reopening reuses it
  useEffect(() => {
    if (autoCreated.current || !taskGUID || !docsQ.isSuccess || documentGUID) return;
    if (documents.length === 0) {
      autoCreated.current = true;
      void newDocument();
    }
  }, [taskGUID, docsQ.isSuccess, documents.length, documentGUID, newDocument]);

  const post = useCallback(async () => {
    if (!header) return null;
    return run(async () => {
      const answer = await postFactDocument(supabase, header.guid);
      await Promise.all([refetchDocuments(), refetchLines(header.guid)]);
      return answer;
    });
  }, [header, run, supabase, refetchDocuments, refetchLines]);

  const unpost = useCallback(async () => {
    if (!header) return null;
    return run(async () => {
      const answer = await unpostFactDocument(supabase, header.guid);
      await Promise.all([refetchDocuments(), refetchLines(header.guid)]);
      return answer;
    });
  }, [header, run, supabase, refetchDocuments, refetchLines]);

  const saveLine = useCallback(async (lineGUID: string, patch: Parameters<typeof updateFactLine>[2]) => {
    if (!header) return false;
    const row = await run(async () => {
      const r = await updateFactLine(supabase, lineGUID, patch);
      await refetchLines(header.guid);
      return r;
    });
    return !!row;
  }, [header, run, supabase, refetchLines]);

  const addLine = useCallback(async (line: Parameters<typeof insertFactLine>[1]) => {
    if (!header) return false;
    const row = await run(async () => {
      const r = await insertFactLine(supabase, line);
      await refetchLines(header.guid);
      return r;
    });
    return !!row;
  }, [header, run, supabase, refetchLines]);

  const removeLine = useCallback(async (lineGUID: string) => {
    if (!header) return false;
    const ok = await run(async () => {
      await deleteFactLine(supabase, lineGUID);
      await refetchLines(header.guid);
      return true;
    });
    return !!ok;
  }, [header, run, supabase, refetchLines]);

  const removeDocument = useCallback(async () => {
    if (!header) return false;
    const ok = await run(async () => {
      await deleteFactDocument(supabase, header.guid);
      setPicked(null);
      await refetchDocuments();
      return true;
    });
    return !!ok;
  }, [header, run, supabase, refetchDocuments]);

  // a new draft that was just made is the one shown; picking a document that disappeared falls back to the default choice
  useEffect(() => {
    if (picked && documents.length && !documents.some((d) => d.rowGUID === picked)) setPicked(null);
  }, [documents, picked]);

  const error = actionError ?? ((docsQ.error as Error | null)?.message || (linesQ.error as Error | null)?.message || null);
  return {
    taskName: taskQ.data?.name ?? '',
    projectGUID: taskQ.data?.projectGUID ?? null,
    documents,
    header,
    lines,
    isLoading: docsQ.isLoading || (!!header && linesQ.isLoading),
    error,
    busy,
    select: setPicked,
    newDocument,
    post,
    unpost,
    saveLine,
    addLine,
    removeLine,
    removeDocument,
    refetch: () => { void refetchDocuments(); if (header) void refetchLines(header.guid); },
  };
}
