// PMProjectEstimationView - the "Estimation" view (right pane of PMGanttSurface when uxuiSettings.ganttVsNetworkView = 'showEstimationView'; the task tree stays on the left).
//   It shows the SAME table as Project settings -> Estimation (ProjectEstimationTable: the task lines of the estimation project per budget item + what this project holds now),
//   read from the link project_table.rowJSON.projectEstimationGUID. No link = a hint where to set it. Nothing is written here: the link and the Fill button live in Project settings.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePMStore } from '../../../store/store_pm';
import type { PMPalette } from '../../theme';
import { PMTipIcon } from '../../../inner/buttons';
import { PMToolbar } from '../../../inner/toolbars/PMToolbarPrimitives';
import { pmT } from '../../../i18n/pmT';
import ProjectEstimationTable from './ProjectEstimationTable';
import { estimationCurrencyDiffers, estimationLinkOf } from './estimationModel';
import { useEstimationRate, useEstimationSummary } from './useProjectEstimation';

export interface PMProjectEstimationViewProps {
  projectGUID: string;
  width: number;
  height: number;
  palette: PMPalette;
}

export default function PMProjectEstimationView({ projectGUID, width, height, palette }: PMProjectEstimationViewProps) {
  const projectJSON = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON);
  const link = estimationLinkOf(projectJSON);
  const summary = useEstimationSummary(projectGUID, link);
  const data = summary.data ?? null;
  const ownCurrency = data?.target?.currencyForBudget || (projectJSON as any)?.currencyForBudget || '';
  const sourceCurrency = data?.source.currencyForBudget || '';
  const differ = estimationCurrencyDiffers(sourceCurrency, ownCurrency);
  const rate = useEstimationRate(sourceCurrency, ownCurrency, differ);
  const error = summary.error ? String((summary.error as any)?.message || summary.error).replace(/^No permission:\s*/i, '') : null;

  return (
    <View style={{ width, height, backgroundColor: palette.background }} testID="pm-estimation-view">
      <PMToolbar background={palette.surface} border={palette.border}>
        <PMTipIcon tip={pmT('Estimation')} testID="pm-estimation-icon" name="calculate" size={18} color={palette.primary} style={{ marginHorizontal: 4 }} />
        <Text style={[styles.title, { color: palette.text }]} testID="pm-estimation-title" numberOfLines={1}>
          {data ? `${pmT('Estimation')}: ${data.source.name}` : pmT('Estimation')}
        </Text>
      </PMToolbar>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {!link ? (
          <Text testID="pm-estimation-none" style={{ color: palette.textMuted }}>{pmT('No estimation project is set. Pick it in Project settings, tab Estimation.')}</Text>
        ) : (
          <ProjectEstimationTable summary={data} loading={summary.isLoading} error={error} rate={rate.data ?? null} targetCurrency={ownCurrency || null} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  body: { padding: 12 },
});
