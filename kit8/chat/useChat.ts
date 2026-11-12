// Chat - the hooks. Realtime goes through redux (useRealtimeEntity, kit8/redux/reusable): the theme and member rows tell the lists and the red number when to read again; the
// messages of the OPEN theme are a scoped redux list. The lists with computed values (title of a task chat, unread numbers) are RPCs.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { useChatClient } from './useChatClient';
import { useRealtimeEntity } from '../redux/reusable/useRealtimeEntity';
import { selectIsLoggedIn } from '../redux/activeUserSlice';
import {
  CHAT_TABLES, chatTaskTitle, mergeMessages, unreadTotal, type ChatCandidate, type ChatMemberItem, type ChatMessageRow, type ChatThemeItem, type ChatUnread,
} from './chatModel';
import { chatCanManage, chatMemberCandidates, chatThemeList, chatThemeMembers, chatUnreadCounts } from './chatApi';

const READ_ALL = { paginationSize: 1000, originationCurrentPage: 0 };

/** a string that changes when a theme got a message / a member row changed (the realtime rows of the redux entities): the signal to read the RPCs again */
export function useChatLiveSignal(enabled = true): string {
  useRealtimeEntity(CHAT_TABLES.theme.entity, { readParams: READ_ALL, enabled });
  useRealtimeEntity(CHAT_TABLES.member.entity, { readParams: READ_ALL, enabled });
  const themes: any[] = useSelector((s: any) => s?.[CHAT_TABLES.theme.entity]?.entityDataFromServer, shallowEqual) ?? [];
  const members: any[] = useSelector((s: any) => s?.[CHAT_TABLES.member.entity]?.entityDataFromServer, shallowEqual) ?? [];
  return useMemo(
    () => JSON.stringify([
      (themes || []).map((r) => [r.rowGUID, r.rowJSON?.lastMessageAt ?? null]),
      (members || []).map((r) => [r.rowGUID, r.rowJSON?.lastReadAt ?? null, r.rowJSON?.role ?? null]),
    ]),
    [themes, members],
  );
}

/** runs `load` now and again when `signal` changes (a short pause joins a burst of events) */
function useReload<T>(load: () => Promise<T>, signal: string, enabled: boolean, onResult: (r: T) => void) {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => {
      load().then((r) => { if (alive.current) onResult(r); }).catch(() => {});
    }, 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal, enabled]);
}

export function useChatThemes(enabled = true): { themes: ChatThemeItem[]; loading: boolean; error: string; reload: () => void } {
  const supabase = useChatClient();
  const loggedIn = useSelector(selectIsLoggedIn);
  const on = enabled && !!supabase && !!loggedIn;
  const signal = useChatLiveSignal(on);
  const [themes, setThemes] = useState<ChatThemeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useReload(() => chatThemeList(supabase as any), `${signal}|${tick}`, on, (r) => {
    setLoading(false);
    if (r.ok) { setThemes(Array.isArray(r.data) ? r.data : []); setError(''); } else setError(r.error);
  });
  return { themes, loading, error, reload: () => setTick((n) => n + 1) };
}

/** the red number: the unread messages of all the themes the user sees. Idle while signed out. */
export function useChatUnread(enabled = true): { counts: ChatUnread[]; total: number; reload: () => void } {
  const supabase = useChatClient();
  const loggedIn = useSelector(selectIsLoggedIn);
  const on = enabled && !!supabase && !!loggedIn;
  const signal = useChatLiveSignal(on);
  const [counts, setCounts] = useState<ChatUnread[]>([]);
  const [tick, setTick] = useState(0);
  useReload(() => chatUnreadCounts(supabase as any), `${signal}|${tick}`, on, (r) => { if (r.ok) setCounts(Array.isArray(r.data) ? r.data : []); });
  useEffect(() => { if (!on) setCounts([]); }, [on]);
  return { counts, total: unreadTotal(counts), reload: () => setTick((n) => n + 1) };
}

/** the messages of ONE theme: a scoped redux list (newest `limit` from the server + the realtime rows) merged with what this device just sent */
export function useChatMessages(themeGUID: string, limit = 200, sentHere: ChatMessageRow[] = []): { messages: ChatMessageRow[]; hasMore: boolean } {
  const readParams = useMemo(() => ({ paginationSize: limit, originationCurrentPage: 0, orderBy: 'created_at', ascending: false, match: { rowParentGUID: themeGUID } }), [limit, themeGUID]);
  useRealtimeEntity(CHAT_TABLES.message.entity, { filter: `rowParentGUID=eq.${themeGUID}`, readParams, enabled: !!themeGUID });
  const rows: any[] = useSelector((s: any) => s?.[CHAT_TABLES.message.entity]?.entityDataFromServer, shallowEqual) ?? [];
  return useMemo(() => {
    const mine = (Array.isArray(rows) ? rows : []).filter((r) => r?.rowParentGUID === themeGUID) as ChatMessageRow[];
    return { messages: mergeMessages(mine, sentHere.filter((m) => m.rowParentGUID === themeGUID)), hasMore: mine.length >= limit };
  }, [rows, sentHere, themeGUID, limit]);
}

export function useChatMembers(themeGUID: string, enabled = true): { members: ChatMemberItem[]; reload: () => void } {
  const supabase = useChatClient();
  const signal = useChatLiveSignal(enabled && !!themeGUID);
  const [members, setMembers] = useState<ChatMemberItem[]>([]);
  const [tick, setTick] = useState(0);
  useReload(() => chatThemeMembers(supabase as any, themeGUID), `${signal}|${tick}`, enabled && !!themeGUID && !!supabase, (r) => { if (r.ok) setMembers(Array.isArray(r.data) ? r.data : []); });
  return { members, reload: () => setTick((n) => n + 1) };
}

export function useChatCandidates(enabled: boolean): ChatCandidate[] {
  const supabase = useChatClient();
  const [list, setList] = useState<ChatCandidate[]>([]);
  useEffect(() => {
    if (!enabled || !supabase) return;
    let alive = true;
    chatMemberCandidates(supabase as any).then((r) => { if (alive && r.ok) setList(Array.isArray(r.data) ? r.data : []); });
    return () => { alive = false; };
  }, [enabled, supabase]);
  return list;
}

/** may the user add / exclude members here (administrator, project manager) */
export function useChatCanManage(themeGUID: string): boolean {
  const supabase = useChatClient();
  const [can, setCan] = useState(false);
  useEffect(() => {
    if (!themeGUID || !supabase) { setCan(false); return; }
    let alive = true;
    chatCanManage(supabase as any, themeGUID).then((r) => { if (alive) setCan(r.ok && r.data === true); });
    return () => { alive = false; };
  }, [themeGUID, supabase]);
  return can;
}

export interface ChatTaskLive { loaded: boolean; gone: boolean; title: string; description: string; projectGUID: string; /** the project of the task is read-only (live) */ projectIsReadonly: boolean }
/** the task behind a task chat, LIVE: its text and notes (title + description) and the project (the prefix), also in a new browser window where nothing is cached */
export function useChatTaskLive(taskGUID: string): ChatTaskLive {
  const supabase = useChatClient();
  const [task, setTask] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [gone, setGone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const loadTask = useCallback(async () => {
    if (!supabase || !taskGUID) return;
    const { data } = await (supabase as any).from('project_task_table').select('rowGUID, projectGUID, rowJSON').eq('rowGUID', taskGUID).maybeSingle();
    setGone(!data);
    setTask(data || null);
    setLoaded(true);
  }, [supabase, taskGUID]);
  const projectGUID: string = task?.projectGUID || '';
  const loadProject = useCallback(async () => {
    if (!supabase || !projectGUID) return;
    const { data } = await (supabase as any).from('project_table').select('rowGUID, rowJSON').eq('rowGUID', projectGUID).maybeSingle();
    setProject(data || null);
  }, [supabase, projectGUID]);
  useEffect(() => {
    if (!supabase || !taskGUID) return;
    loadTask();
    const ch = (supabase as any).channel(`chat-task-${taskGUID}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_task_table', filter: `rowGUID=eq.${taskGUID}` }, () => loadTask())
      .subscribe();
    return () => { try { (supabase as any).removeChannel(ch); } catch { /* closed */ } };
  }, [supabase, taskGUID, loadTask]);
  useEffect(() => {
    if (!supabase || !projectGUID) return;
    loadProject();
    const ch = (supabase as any).channel(`chat-project-${projectGUID}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_table', filter: `rowGUID=eq.${projectGUID}` }, () => loadProject())
      .subscribe();
    return () => { try { (supabase as any).removeChannel(ch); } catch { /* closed */ } };
  }, [supabase, projectGUID, loadProject]);
  return {
    loaded,
    gone,
    title: task ? chatTaskTitle(project?.rowJSON, task.rowJSON?.taskDescription) : '',
    description: String(task?.rowJSON?.notes ?? ''),
    projectGUID,
    projectIsReadonly: project?.rowJSON?.projectIsReadonly === true,
  };
}
