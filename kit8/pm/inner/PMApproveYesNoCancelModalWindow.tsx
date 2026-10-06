// PMApproveYesNoCancelModalWindow: the PM module's own approval dialog (instead of
// window.confirm / Alert.alert) - used before every delete and before undo.
//
//   const answer = await askPMApprove({ title, message, yesLabel: 'Delete', destructive: true });
//   if (answer === 'yes') ...            // 'yes' | 'no' | 'cancel'
//
// Yes  = do it.  No = do not do it.  Cancel = close the window (also: backdrop, Esc,
// Android back). Web keyboard: Enter = Yes, Esc = Cancel.
// Render <PMApproveYesNoCancelModalWindow /> once per screen (dashboard, task page); when
// no window is mounted, askPMApprove falls back to the platform confirm.

import React, { useEffect } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import { PMDialogButton } from './buttons/PMDialogButton';
import { pmT } from '../i18n/pmT';

export type PMApproveAnswer = 'yes' | 'no' | 'cancel';

export interface PMApproveRequest {
  title: string;
  message?: string;
  /** Material symbol shown next to the title (default: delete / help). */
  icon?: string;
  yesLabel?: string; // default 'Yes'
  noLabel?: string; // default 'No'
  cancelLabel?: string; // default 'Cancel'
  /** Yes is drawn in the error color (deletes). */
  destructive?: boolean;
}

interface ApproveState {
  mounted: number;
  request: (PMApproveRequest & { resolve: (a: PMApproveAnswer) => void }) | null;
  open: (r: PMApproveRequest & { resolve: (a: PMApproveAnswer) => void }) => void;
  answer: (a: PMApproveAnswer) => void;
  mount: (delta: 1 | -1) => void;
}

const useApproveStore = create<ApproveState>((set, get) => ({
  mounted: 0,
  request: null,
  open: (r) => {
    get().request?.resolve('cancel'); // a new question replaces an unanswered one
    set({ request: r });
  },
  answer: (a) => {
    const r = get().request;
    set({ request: null });
    r?.resolve(a);
  },
  mount: (delta) => set((s) => ({ mounted: Math.max(0, s.mounted + delta) })),
}));

/** true while the approval window is open (keyboard shortcuts should pause). */
export function isPMApproveOpen(): boolean {
  return !!useApproveStore.getState().request;
}

function platformConfirm(r: PMApproveRequest): Promise<PMApproveAnswer> {
  if (Platform.OS === 'web') {
    const w: any = typeof window !== 'undefined' ? window : null;
    return Promise.resolve(w?.confirm ? (w.confirm(`${r.title}${r.message ? `\n\n${r.message}` : ''}`) ? 'yes' : 'no') : 'yes');
  }
  return new Promise((resolve) =>
    Alert.alert(r.title, r.message, [
      { text: r.cancelLabel || 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
      { text: r.noLabel || 'No', onPress: () => resolve('no') },
      { text: r.yesLabel || 'Yes', style: r.destructive ? 'destructive' : 'default', onPress: () => resolve('yes') },
    ])
  );
}

/** Ask the user; resolves with 'yes' | 'no' | 'cancel'. */
export function askPMApprove(request: PMApproveRequest): Promise<PMApproveAnswer> {
  const s = useApproveStore.getState();
  if (!s.mounted) return platformConfirm(request);
  return new Promise((resolve) => s.open({ ...request, resolve }));
}

/** Convenience: true only for "Yes". */
export async function approvePM(request: PMApproveRequest): Promise<boolean> {
  return (await askPMApprove(request)) === 'yes';
}

export default function PMApproveYesNoCancelModalWindow() {
  const { themeColors: c } = useDesignSystem();
  const request = useApproveStore((s) => s.request);
  const answer = useApproveStore((s) => s.answer);

  useEffect(() => {
    useApproveStore.getState().mount(1);
    return () => {
      const s = useApproveStore.getState();
      s.mount(-1);
      if (s.mounted <= 1) s.request?.resolve('cancel');
    };
  }, []);

  // web keyboard: Enter = Yes, Esc = Cancel (captured before the screen's shortcuts)
  useEffect(() => {
    if (Platform.OS !== 'web' || !request || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        answer('yes');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        answer('cancel');
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [request, answer]);

  if (!request) return null;
  const yesColor = request.destructive ? c.error : c.primary;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => answer('cancel')}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => answer('cancel')} accessibilityLabel={pmT('Cancel')} />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID="pm-approve-window" accessibilityRole="alert">
          <View style={styles.header}>
            <View style={[styles.iconBubble, { backgroundColor: `${yesColor}1f` }]}>
              <IconApp testID="pm-approve-icon" name={request.icon || (request.destructive ? 'delete' : 'help')} size={20} color={yesColor} />
            </View>
            <Text style={[styles.title, { color: c.text }]}>{request.title}</Text>
          </View>
          {!!request.message && <Text style={[styles.message, { color: c.text }]}>{request.message}</Text>}

          <View style={styles.actions}>
            <PMDialogButton testID="pm-approve-cancel" kind="text" title={request.cancelLabel || 'Cancel'} color={c.text} style={{ marginLeft: 0 }} onPress={() => answer('cancel')} />
            <View style={{ flex: 1 }} />
            <PMDialogButton testID="pm-approve-no" kind="secondary" title={request.noLabel || 'No'} color={c.text} onPress={() => answer('no')} />
            <PMDialogButton
              testID="pm-approve-yes"
              kind={request.destructive ? 'dangerContained' : 'primary'}
              title={request.yesLabel || 'Yes'}
              onPress={() => answer('yes')}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  iconBubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  message: { marginTop: 10, fontSize: 14, lineHeight: 20, opacity: 0.85 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
});
