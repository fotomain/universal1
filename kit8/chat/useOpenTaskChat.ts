// useOpenTaskChat - "Create based on this -> Chat" and the icon "Go to Chat": chat_task_ensure (the first call makes the chat of the task, later calls open it), then the theme view opens
// (a NEW browser window on the web, the route on a phone). A refusal (no right, not a member, the chat is switched off) is shown in the error window.
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useChatClient } from './useChatClient';
import { pmT } from '../pm/i18n/pmT';
import { showErrorModal } from '../ui/components/common/ErrorModalWindow';
import { chatTaskEnsure } from './chatApi';
import { openChatTheme } from './chatNavigation';

export function useOpenTaskChat(): (taskGUID: string) => Promise<boolean> {
  const router = useRouter();
  const supabase = useChatClient();
  return useCallback(async (taskGUID: string) => {
    if (!taskGUID) return false;
    const r = await chatTaskEnsure(supabase as any, taskGUID);
    if (!r.ok) { showErrorModal(r.error, pmT('Cannot open the chat of the task')); return false; }
    openChatTheme({ themeGUID: r.data.themeGUID, taskGUID }, router);
    return true;
  }, [router, supabase]);
}
