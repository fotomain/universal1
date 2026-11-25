// FillProjectFromEstimationButton - "Fill project from estimation": copies ALL the data of the estimation project (stages, tasks, links, task lines) into the project that names it.
// It only opens the window (FillProjectFromEstimationWindow) where the user decides Append / Replace; it is disabled - with the reason written under it - while the copy cannot be done.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import { PMDialogButton } from '../../../inner/buttons/PMDialogButton';
import { pmT } from '../../../i18n/pmT';
import type { PMProjectRow } from '../../../model/types';
import type { EstimationSummary, FillBlockReason } from './estimationModel';
import FillProjectFromEstimationWindow from './FillProjectFromEstimationWindow';

/** the sentence under a disabled button (null = the button is enabled) */
export function fillBlockText(reason: FillBlockReason | null): string {
  switch (reason) {
    case 'noEstimation': return pmT('Pick the estimation project first.');
    case 'loading': return pmT('Reading the estimation...');
    case 'estimationMissing': return pmT('The estimation project is not found or you cannot read it.');
    case 'estimationEmpty': return pmT('The estimation project has no tasks: nothing to copy.');
    case 'projectNotSaved': return pmT('Save the project first (the Save button): then the estimation can be copied into it.');
    case 'unsavedSettings': return pmT('The estimation project was changed in this window: save the settings first.');
    case 'projectReadonly': return pmT('Read-only project: nothing can be changed.');
    case 'noRight': return pmT('You may not create tasks in this project.');
    default: return '';
  }
}

export interface FillProjectFromEstimationButtonProps {
  blockReason: FillBlockReason | null;
  summary: EstimationSummary | null;
  /** the estimation project (read) */
  source: PMProjectRow | null | undefined;
  /** the project that is filled, as saved (null = not saved yet) */
  target: PMProjectRow | null | undefined;
  ownerGUID: string;
  testID?: string;
}

export default function FillProjectFromEstimationButton({ blockReason, summary, source, target, ownerGUID, testID = 'pm-estimation-fill-button' }: FillProjectFromEstimationButtonProps) {
  const { themeColors: c } = useDesignSystem();
  const [open, setOpen] = useState(false);
  const ready = !blockReason && !!summary && !!summary.target && !!source && !!target;
  return (
    <View style={styles.root} testID={`${testID}-box`}>
      <PMDialogButton testID={testID} kind="primary" icon="download" title="Fill project from estimation" disabled={!ready} onPress={() => setOpen(true)} />
      {!!blockReason && <Text testID={`${testID}-reason`} style={[styles.hint, { color: c.text }]}>{fillBlockText(blockReason)}</Text>}
      {ready && summary && (
        <Text testID={`${testID}-what`} style={[styles.hint, { color: c.text }]}>
          {pmT('{{tasks}} tasks, {{links}} links and {{lines}} task lines will be copied. The lines are not posted.', { tasks: summary.source.tasks, links: summary.source.links, lines: summary.source.lines })}
        </Text>
      )}
      {ready && summary && source && target && (
        <FillProjectFromEstimationWindow visible={open} onClose={() => setOpen(false)} source={source} target={target} summary={summary} ownerGUID={ownerGUID} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 12, alignItems: 'flex-start', gap: 6 },
  hint: { fontSize: 12, opacity: 0.75 },
});
