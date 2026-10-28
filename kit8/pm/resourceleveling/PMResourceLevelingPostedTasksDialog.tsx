// PMResourceLevelingPostedTasksDialog - the question about POSTED tasks (documentation/RESOURCE_LEVELING_WBS.html 7.7): a posted task that has to move loses its posting (its lines and
// payments are unposted by the existing triggers), so the optimization never does it without asking. Three choices:
//   Unpost and move       the tasks are moved and stay unposted until Post
//   Move and post again   the tasks are moved and posted again by the app, only if they post without conflicts
//   Keep their dates      the posted tasks do not move (the plan is made again without them)
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { formatDateISO } from '../view/project/scheduling';
import { pmT } from '../i18n/pmT';
import type { PlannedMove, PostedChoice } from './resourceLevelingRun';

export default function PMResourceLevelingPostedTasksDialog({ tasks, onChoose, onCancel }: { tasks: PlannedMove[]; onChoose: (choice: PostedChoice) => void; onCancel: () => void }) {
  const { themeColors: c, isDark } = useDesignSystem();
  const button = (testID: string, label: string, hint: string, choice: PostedChoice, primary = false) => (
    <Pressable key={choice} testID={testID} accessibilityRole="button" onPress={() => onChoose(choice)} style={[s.choice, { borderColor: primary ? c.primary : c.border, backgroundColor: primary ? c.primary : 'transparent' }]}>
      <Text style={{ color: primary ? '#ffffff' : c.text, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: primary ? '#ffffff' : c.text, opacity: 0.8, fontSize: 12, marginTop: 2 }}>{hint}</Text>
    </Pressable>
  );
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: isDark ? '#1f1e24' : '#ffffff' }]} testID="pm-resource-leveling-posted-dialog">
          <Text style={[s.title, { color: c.text }]}>{pmT('{{n}} posted task(s) have to move', { n: tasks.length })}</Text>
          <Text style={[s.sub, { color: c.text }]}>{pmT('Moving a posted task unposts its lines and payments. What should be done with them?')}</Text>
          <ScrollView style={s.list} testID="pm-resource-leveling-posted-list">
            {tasks.map((t) => (
              <Text key={t.task} style={[s.item, { color: c.text }]}>{pmT('{{name}}: {{from}} → {{to}}', { name: t.name, from: formatDateISO(t.startBeforeMs), to: formatDateISO(t.startAfterMs) })}</Text>
            ))}
          </ScrollView>
          {button('pm-resource-leveling-posted-unpost', pmT('Unpost and move'), pmT('The tasks are moved and stay unposted until you post them.'), 'unpostAndMove')}
          {button('pm-resource-leveling-posted-repost', pmT('Move and post again'), pmT('The tasks are moved and posted again, but only if they post without conflicts; otherwise they stay where they are.'), 'moveAndPostAgain', true)}
          {button('pm-resource-leveling-posted-keep', pmT('Keep their dates'), pmT('The posted tasks do not move; the plan is made again without them.'), 'keep')}
          <Pressable testID="pm-resource-leveling-posted-cancel" accessibilityRole="button" onPress={onCancel} style={s.cancel}>
            <Text style={{ color: c.text, fontWeight: '600' }}>{pmT('Cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 560, maxHeight: '90%', borderRadius: 16, padding: 18 },
  title: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 13, opacity: 0.8, marginTop: 6, marginBottom: 8 },
  list: { maxHeight: 140, marginBottom: 10 },
  item: { fontSize: 13, paddingVertical: 2 },
  choice: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, minHeight: 48 },
  cancel: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 12 },
});
