// PMTaskSubprojectField - the "Subproject" part of the task window (documentation/SUBPROJECTS_BRD_TRD.html): the switch taskIsSubproject and, with it on, the picker of the project (taskSubprojectGUID).
// Shown only for a TASK of a project with subprojectsFunctionalityEnabled. The picker lists what the database allows (RPC subproject_candidates: same organization, not the project itself, no cycle).
// While the origin task follows the dates of its subproject (autoChangeOriginTaskBasedOnSubprojects + autoChangeStartAndFinishDatesForOriginTask) a hint says that its dates come from there.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SwitchApp from '../../../ui/components/common/SwitchApp';
import SelectItemFromListApp from '../../../ui/components/common/SelectItemFromListApp';
import { pmT } from '../../i18n/pmT';
import { PMSubprojectCandidate } from '../../subproject/subprojectModel';

export interface PMTaskSubprojectFieldProps {
  flag: boolean;
  onFlag: (on: boolean) => void;
  subprojectGUID: string;
  onSubproject: (guid: string) => void;
  candidates: readonly PMSubprojectCandidate[];
  /** the origin task takes the dates of the subproject (the project switches say so) */
  followsDates: boolean;
  error?: string | null;
  testID?: string;
}

export default function PMTaskSubprojectField({ flag, onFlag, subprojectGUID, onSubproject, candidates, followsDates, error, testID = 'pm-edit-subproject' }: PMTaskSubprojectFieldProps) {
  const items = useMemo(() => candidates.map((c) => ({ value: c.projectGUID, label: c.projectName || c.projectGUID, description: c.usedByCount > 0 ? pmT('Used by {{n}} task(s)', { n: c.usedByCount }) : undefined })), [candidates]);
  return (
    <View testID={testID} style={styles.wrap}>
      <SwitchApp testID={`${testID}-flag`} label={pmT('Subproject (taskIsSubproject)')} value={flag} onValueChange={onFlag} />
      {flag && (
        <SelectItemFromListApp
          testID={`${testID}-project`}
          items={items}
          value={subprojectGUID || null}
          onSelect={(v: string) => onSubproject(v)}
          placeholder={pmT('Subproject')}
          searchPlaceholder={pmT('Subproject')}
          clearable
          fieldHeight={42}
          fieldRadius={4}
        />
      )}
      {flag && !!subprojectGUID && followsDates && <Text testID={`${testID}-follows`} style={styles.hint}>{pmT('The start and the finish of this task come from the subproject.')}</Text>}
      {!!error && <Text testID={`${testID}-error`} style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  hint: { fontSize: 12, opacity: 0.65, marginTop: 4 },
  error: { fontSize: 12, color: '#b91c1c', marginTop: 4 },
});
