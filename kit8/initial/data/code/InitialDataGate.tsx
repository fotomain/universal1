// InitialDataGate - the FIRST RUN of the application (documentation/INITIAL_DATA_WBS.html), mounted once in app/_layout.tsx.
//   After a user is signed in it asks the database ONE question (initial_data_status) and decides:
//     nothing required is missing  -> nothing is shown
//     NOTHING exists (new database) -> CreateInitialProgramData runs BY ITSELF (auto), only the progress is shown
//     a PART is missing             -> CreateInitialProgramData opens as a list; the user presses Create
//     this user may not write       -> the screen says who can
//   The button Skip of the screen dismisses it WITHOUT creating anything (asked again at the next start of the application).
//   While it is open it covers the whole window (a Modal): no menu, no button of the application works. When the run is over it opens the home page.
//   The check is made once per signed-in user and application run. If the check itself cannot be made (the SQL PART 60 is not installed yet, no network) the application is NOT locked.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { router } from 'expo-router';
import { useSupabase } from '../../../providers/WithSupabase';
import CreateInitialProgramData from './CreateInitialProgramData';
import { useInitialData } from './useInitialData';

export default function InitialDataGate() {
  const { supabase } = useSupabase();
  const ctl = useInitialData({ supabase, autoCheck: false });
  const [open, setOpen] = useState(false);
  const checkedFor = useRef<string | null>(null);
  const checkRef = useRef(ctl.check);
  checkRef.current = ctl.check;

  const runCheck = useCallback(async (userId: string) => {
    if (checkedFor.current === userId) return;
    checkedFor.current = userId;
    const res = await checkRef.current();
    if (!res) { console.warn('initial data: the check could not be made (is SQL PART 60 installed?) - the application is not locked'); return; }
    if (res.decision.kind !== 'ready') setOpen(true);
  }, []);

  useEffect(() => {
    if (!supabase?.auth) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }: any) => { const id = data?.session?.user?.id; if (alive && id) void runCheck(id); });
    const sub = supabase.auth.onAuthStateChange((event: string, session: any) => {
      if (event === 'SIGNED_OUT') { checkedFor.current = null; setOpen(false); }
      else if (session?.user?.id && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) void runCheck(session.user.id);
    });
    return () => { alive = false; sub?.data?.subscription?.unsubscribe?.(); };
  }, [supabase, runCheck]);

  const finished = useCallback((ok: boolean) => {
    setOpen(false);
    if (ok) { try { router.replace('/home'); } catch { /* the navigation is not ready: the user is already on a screen */ } }
  }, []);
  const release = useCallback(() => setOpen(false), []);

  if (!open || !ctl.decision) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={() => { /* the first run cannot be dismissed */ }}>
      <View testID="initial-data-gate" style={{ flex: 1 }}>
        <CreateInitialProgramData controller={ctl} locked auto={ctl.decision.kind === 'auto'} onFinished={finished} onContinueWithout={release} onSkip={release} />
      </View>
    </Modal>
  );
}
