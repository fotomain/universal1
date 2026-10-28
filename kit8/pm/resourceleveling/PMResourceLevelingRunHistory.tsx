// PMResourceLevelingRunHistory - the runs of Resource optimization of the project (who, when, mode, method, the counts), with Undo of a run (documentation/RESOURCE_LEVELING_WBS.html 9).
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSupabase } from '../../providers/WithSupabase';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { pmT } from '../i18n/pmT';
import { fetchLevelingRuns, type LevelingRunRow } from './resourceLevelingApi';
import { useResourceLevelingUiStore } from './resourceLevelingUiStore';

const kindText = (k: LevelingRunRow['runKind']) => (k === 'level' ? pmT('Level') : k === 'clear' ? pmT('Clear leveling') : pmT('Undo'));

export default function PMResourceLevelingRunHistory({ projectGUID, onUndo }: { projectGUID: string | null | undefined; onUndo: (runGUID: string) => void }) {
  const { themeColors: c, isDark } = useDesignSystem();
  const { supabase } = useSupabase();
  const open = useResourceLevelingUiStore((st) => st.history);
  const busy = useResourceLevelingUiStore((st) => st.busy);
  const [runs, setRuns] = useState<LevelingRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !projectGUID) return;
    let live = true;
    setRuns(null);
    setError(null);
    fetchLevelingRuns(supabase, projectGUID).then((r) => { if (live) setRuns(r); }).catch((e) => { if (live) setError(String(e?.message || e)); });
    return () => { live = false; };
  }, [open, projectGUID, supabase, busy]);
  if (!open) return null;
  const close = () => useResourceLevelingUiStore.getState().setHistory(false);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: isDark ? '#1f1e24' : '#ffffff' }]} testID="pm-resource-leveling-history">
          <Text style={[s.title, { color: c.text }]}>{pmT('Resource optimization – runs')}</Text>
          <ScrollView style={s.list}>
            {error && <Text style={{ color: c.error || '#b91c1c' }}>{error}</Text>}
            {!runs && !error && <Text style={{ color: c.text, opacity: 0.7 }}>{pmT('Loading…')}</Text>}
            {runs && runs.length === 0 && <Text style={{ color: c.text, opacity: 0.7 }}>{pmT('No run yet.')}</Text>}
            {runs?.map((r, i) => (
              <View key={r.rowGUID} style={[s.row, { borderColor: c.border }]} testID={`pm-resource-leveling-history-row-${i}`}>
                <Text style={{ color: c.text, fontWeight: '700' }}>{kindText(r.runKind)} · {r.runMode} · {r.runMethod}</Text>
                <Text style={{ color: c.text, fontSize: 12, opacity: 0.75 }}>
                  {new Date(r.created_at).toLocaleString()} · {pmT('{{n}} task(s) moved', { n: r.tasksMoved })} · {pmT('{{n}} not solved', { n: r.unresolvedCount })}
                </Text>
                {r.runKind !== 'undo' && !r.undoneByGUID && (
                  <Pressable testID={`pm-resource-leveling-history-undo-${i}`} accessibilityRole="button" disabled={busy} onPress={() => onUndo(r.rowGUID)} style={[s.undo, { borderColor: c.primary }]}>
                    <Text style={{ color: c.primary, fontWeight: '700' }}>{pmT('Undo run')}</Text>
                  </Pressable>
                )}
                {!!r.undoneByGUID && <Text style={{ color: c.text, fontSize: 12, opacity: 0.6 }}>{pmT('Undone')}</Text>}
              </View>
            ))}
          </ScrollView>
          <Pressable testID="pm-resource-leveling-history-close" accessibilityRole="button" onPress={close} style={[s.close, { backgroundColor: c.primary }]}>
            <Text style={{ color: '#ffffff', fontWeight: '700' }}>{pmT('Close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 640, maxHeight: '88%', borderRadius: 16, padding: 18 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  list: { flexGrow: 0, maxHeight: 420 },
  row: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 8, marginBottom: 6 },
  undo: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 12, marginTop: 6 },
  close: { alignSelf: 'flex-end', marginTop: 10, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 8 },
});
