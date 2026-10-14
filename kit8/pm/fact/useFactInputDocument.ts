// useFactInputDocument - the data of the form PMFactInputDocumentForm: the documents of a task (newest first, with their totals: task_fact_document_list), the selected one
// (the latest DRAFT unless told which) and the commands (new document, post, unpost, delete the document).
// The LINES are not here: the ReusableTable of the form reads and edits them through the redux entity FACT_USAGE_TIMELINE_ENTITY (realtime, optimistic, sums computed by the database);
// `refreshLines` reads them again after a command that changed them on the server (a new document).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../providers/WithSupabase';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { createFactDocument, deleteFactDocument, fetchFactDocumentList, fetchTaskInfo, postFactDocument, unpostFactDocument } from './factInputApi';
import { FACT_USAGE_TIMELINE_ENTITY, FactHeaderView, FactListRow, FactPostAnswer, factHeaderFromListRow, latestDraftOf } from './factInputModel';

export const factDocumentsKey = (taskGUID: string) => ['pm', 'factDocuments', taskGUID] as const;
export const factTaskKey = (taskGUID: string) => ['pm', 'factTask', taskGUID] as const;

const NO_ROWS: never[] = [];

export interface UseFactInputDocument {
  taskName: string;
  projectGUID: string | null;
  documents: FactListRow[];
  header: FactHeaderView | null;
  isLoading: boolean;
  error: string | null;
  busy: boolean;
  select: (headerGUID: string) => void;
  newDocument: () => Promise<string | null>;
  post: () => Promise<FactPostAnswer | null>;
  unpost: () => Promise<FactPostAnswer | null>;
  removeDocument: () => Promise<boolean>;
  /** read the lines of the task from the server again into redux */
  refreshLines: () => void;
  refetch: () => void;
}

export function useFactInputDocument(taskGUID: string, documentGUID?: string | null): UseFactInputDocument {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const dispatch = useDispatch();
  const [picked, setPicked] = useState<string | null>(documentGUID ?? null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const autoCreated = useRef(false);

  const taskQ = useQuery({ queryKey: factTaskKey(taskGUID), enabled: !!taskGUID, staleTime: 60_000, queryFn: () => fetchTaskInfo(supabase, taskGUID) });
  const docsQ = useQuery({ queryKey: factDocumentsKey(taskGUID), enabled: !!taskGUID, staleTime: 5_000, queryFn: () => fetchFactDocumentList(supabase, null, { taskGUID }) });
  const documents = docsQ.data?.rows ?? (NO_ROWS as FactListRow[]);

  // the document shown: the one picked / asked for, else the latest draft, else the newest
  const row = useMemo(() => documents.find((d) => d.documentGUID === picked) ?? latestDraftOf(documents) ?? documents[0], [documents, picked]);
  const header = useMemo(() => (row ? factHeaderFromListRow(row) : null), [row]);

  const refetchDocuments = useCallback(() => qc.invalidateQueries({ queryKey: factDocumentsKey(taskGUID) }), [qc, taskGUID]);
  const refreshLines = useCallback(() => {
    const actions = SystemMetaData[FACT_USAGE_TIMELINE_ENTITY]?.actions;
    if (actions?.readData && taskGUID) dispatch(actions.readData({ paginationSize: 1000, originationCurrentPage: 0, match: { rowOwnerGUID: taskGUID } }));
  }, [dispatch, taskGUID]);

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
      await refetchDocuments();
      refreshLines();
      return g;
    });
    if (guid) setPicked(guid);
    return guid;
  }, [run, supabase, taskGUID, refetchDocuments, refreshLines]);

  // no document at all and none asked for: the first open makes a draft with the lines of the task - once; reopening reuses it
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
      await refetchDocuments();
      return answer;
    });
  }, [header, run, supabase, refetchDocuments]);

  const unpost = useCallback(async () => {
    if (!header) return null;
    return run(async () => {
      const answer = await unpostFactDocument(supabase, header.guid);
      await refetchDocuments();
      return answer;
    });
  }, [header, run, supabase, refetchDocuments]);

  const removeDocument = useCallback(async () => {
    if (!header) return false;
    const ok = await run(async () => {
      await deleteFactDocument(supabase, header.guid);
      setPicked(null);
      await refetchDocuments();
      refreshLines();
      return true;
    });
    return !!ok;
  }, [header, run, supabase, refetchDocuments, refreshLines]);

  // picking a document that disappeared falls back to the default choice
  useEffect(() => {
    if (picked && documents.length && !documents.some((d) => d.documentGUID === picked)) setPicked(null);
  }, [documents, picked]);

  const error = actionError ?? ((docsQ.error as Error | null)?.message || null);
  return {
    taskName: taskQ.data?.name ?? '',
    projectGUID: taskQ.data?.projectGUID ?? null,
    documents,
    header,
    isLoading: docsQ.isLoading,
    error,
    busy,
    select: setPicked,
    newDocument,
    post,
    unpost,
    removeDocument,
    refreshLines,
    refetch: () => { void refetchDocuments(); refreshLines(); },
  };
}
