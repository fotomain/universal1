// PMProjectEstimationTab - the "Estimation" tab of the Project settings window (TabEstimation, right after TabROI). documentation/ESTIMATION/PROJECT_ESTIMATION.html
//   project_table.rowJSON.projectEstimationGUID = the project that is the ESTIMATION of this one (an ordinary project the user makes separately).
//     ProjectEstimationGUIDInput        the project select (always enabled; only a read-only project locks it)
//     ProjectEstimationTable            the sums of that project per budget item (+ what this project holds now)
//     FillProjectFromEstimationButton   copies its tasks, links and task lines into this project
//   The tab is NOT in Organization edit -> Projects -> Settings: the link belongs to ONE project.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { PMDialogButton } from '../../../inner/buttons/PMDialogButton';
import { ESTIMATION_ROUTE } from '../../../estimation/model/estimationModel';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import { useReadProjectQuery } from '../../../crud/project/projectQueries';
import { pmT } from '../../../i18n/pmT';
import type { PMProjectRow } from '../../../model/types';
import FillProjectFromEstimationButton from './FillProjectFromEstimationButton';
import ProjectEstimationGUIDInput from './ProjectEstimationGUIDInput';
import ProjectEstimationTable from './ProjectEstimationTable';
import { estimationCurrencyDiffers, estimationLinkOf, fillBlockReason, type PMProjectEstimationValues } from './estimationModel';
import { useEstimationRate, useEstimationSummary } from './useProjectEstimation';

export interface PMProjectEstimationTabProps {
  /** the draft of the window: the estimation named now */
  values: PMProjectEstimationValues;
  onChange: (patch: PMProjectEstimationValues) => void;
  /** the project as saved (null / undefined = a new project that is not saved yet) */
  savedProject?: PMProjectRow | null;
  ownerGUID: string;
  /** the budget currency in the draft (used while the project is not saved) */
  draftBudgetCurrency?: string | null;
  /** read-only project */
  locked?: boolean;
}

export default function PMProjectEstimationTab({ values, onChange, savedProject, ownerGUID, draftBudgetCurrency = null, locked = false }: PMProjectEstimationTabProps) {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const projectGUID = savedProject?.rowGUID ?? null;
  const draftLink = estimationLinkOf(values);
  const savedLink = estimationLinkOf(savedProject?.rowJSON);
  const source = useReadProjectQuery(draftLink);
  const summary = useEstimationSummary(projectGUID, draftLink);
  const data = summary.data ?? null;
  const ownCurrency = data?.target?.currencyForBudget || draftBudgetCurrency || '';
  const sourceCurrency = data?.source.currencyForBudget || '';
  const differ = estimationCurrencyDiffers(sourceCurrency, ownCurrency);
  const rate = useEstimationRate(sourceCurrency, ownCurrency, differ);
  const reason = fillBlockReason({
    savedEstimationGUID: savedLink,
    draftEstimationGUID: draftLink,
    projectSaved: !!projectGUID,
    loading: summary.isLoading || source.isLoading,
    summary: data,
  });
  const error = summary.error ? String((summary.error as any)?.message || summary.error).replace(/^No permission:\s*/i, '') : null;
  const last = savedProject?.rowJSON?.projectEstimationLastFill;

  return (
    <View testID="pm-project-tab-estimation-content">
      <ProjectEstimationGUIDInput projectGUID={projectGUID} ownerGUID={ownerGUID} value={draftLink} onChange={(guid) => onChange({ projectEstimationGUID: guid })} locked={locked} />
      {!!last && last.sourceGUID === draftLink && (
        <Text testID="pm-project-estimation-last" style={[styles.hint, { color: c.text }]}>
          {pmT('Last fill: {{date}} - {{n}} tasks, {{lines}} task lines.', { date: String(last.at || '').replace('T', ' ').slice(0, 16), n: last.tasks, lines: last.lines })}
        </Text>
      )}
      {!!draftLink && (
        <ProjectEstimationTable summary={data} loading={summary.isLoading} error={error} rate={rate.data ?? null} targetCurrency={draftBudgetCurrency} />
      )}
      <FillProjectFromEstimationButton blockReason={reason} summary={data} source={source.data} target={savedProject} ownerGUID={ownerGUID} />
      <View style={styles.block}>
        <PMDialogButton
          testID="pm-estimation-open-dashboard"
          kind="primary"
          icon="calculate"
          title="Open the Estimation dashboard"
          disabled={!(draftLink ?? projectGUID)}
          onPress={() => router.push({ pathname: ESTIMATION_ROUTE as any, params: { projectGUID: draftLink ?? projectGUID ?? '' } } as any)}
        />
        <SwitchApp
          testID="pm-project-estimation-gost"
          label={pmT('Use the regulation information (the Methodology of a country) in the documents')}
          value={values.useGOSTInformationInDocuments === true}
          disabled={locked}
          onValueChange={(on) => onChange({ useGOSTInformationInDocuments: on })}
        />
        <Text style={[styles.hint, { color: c.text }]}>{pmT('Off (the default): no country-specific text, form number or authority is shown in the Estimation dashboard and in the exported documents.')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, opacity: 0.75, marginBottom: 6 },
  block: { marginTop: 14, gap: 10 },
});
