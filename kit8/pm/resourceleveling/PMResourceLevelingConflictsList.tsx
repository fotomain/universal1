// PMResourceLevelingConflictsList - the conflicts that a run could NOT solve: the resource, the period, the hours over, and the reason in words (documentation/RESOURCE_LEVELING_WBS.html 9).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { useTaskLineCatalogs } from '../view/task/finances/useTaskLineCatalogs';
import { anyResourceTitle } from '../view/task/finances/taskLineResource';
import { formatDateISO } from '../view/project/scheduling';
import { pmT } from '../i18n/pmT';
import { resourceGuidOfKey } from './resourceLevelingModel';
import { conflictSentence, unresolvedText } from './resourceLevelingText';
import type { PlannedUnresolved } from './resourceLevelingRun';

export default function PMResourceLevelingConflictsList({ conflicts, testID = 'pm-resource-leveling-conflicts', limit = 50 }: { conflicts: PlannedUnresolved[]; testID?: string; limit?: number }) {
  const { themeColors: c } = useDesignSystem();
  const catalogs = useTaskLineCatalogs();
  if (conflicts.length === 0) return null;
  const shown = conflicts.slice(0, limit);
  return (
    <View testID={testID}>
      <Text style={[s.title, { color: c.text }]}>{pmT('{{n}} conflict(s) could not be solved', { n: conflicts.length })}</Text>
      {shown.map((x, i) => {
        const name = anyResourceTitle(catalogs, resourceGuidOfKey(x.resource)) || resourceGuidOfKey(x.resource);
        return (
          <View key={`${x.resource}-${x.bucket}-${i}`} style={[s.row, { borderColor: c.border }]} testID={`${testID}-row-${i}`}>
            <Text style={[s.sentence, { color: c.text }]}>{conflictSentence(x, name, formatDateISO(x.bucket))}</Text>
            <Text style={[s.reason, { color: c.error || '#b91c1c' }]}>{unresolvedText(x.code)}</Text>
            {x.taskNames.length > 0 && <Text style={[s.tasks, { color: c.text }]}>{x.taskNames.slice(0, 6).join(' · ')}{x.taskNames.length > 6 ? ' …' : ''}</Text>}
          </View>
        );
      })}
      {conflicts.length > limit && <Text style={s.more}>{pmT('… and {{n}} more', { n: conflicts.length - limit })}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontWeight: '700', marginTop: 10, marginBottom: 6 },
  row: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 8, marginBottom: 6 },
  sentence: { fontWeight: '600', fontSize: 13 },
  reason: { fontSize: 12, marginTop: 2 },
  tasks: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  more: { fontSize: 12, opacity: 0.6 },
});
