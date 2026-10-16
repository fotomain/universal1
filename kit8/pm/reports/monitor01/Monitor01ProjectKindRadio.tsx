// Monitor01ProjectKindRadio - "Projects | Subprojects | All" (RadioSetApp, horizontal, compact: no borders; it stands in the toolbar of the report after "Collapse all"), shown only when a project of the organization uses subprojects (documentation/SUBPROJECTS_BRD_TRD.html).
//   Projects (default) = the projects that are not a subproject of any task · Subprojects = the projects that are · All = both
import React from 'react';
import { StyleSheet, View } from 'react-native';
import RadioSetApp from '../../../ui/components/RadioSetApp';
import { pmT } from '../../i18n/pmT';
import { Monitor01ProjectKind } from '../../subproject/subprojectModel';

export default function Monitor01ProjectKindRadio({ value, onChange, testID = 'monitor01-project-kind' }: { value: Monitor01ProjectKind; onChange: (k: Monitor01ProjectKind) => void; testID?: string }) {
  return (
    <View style={styles.wrap}>
      <RadioSetApp<Monitor01ProjectKind>
        testID={testID}
        horizontal
        compact
        value={value}
        onChange={onChange}
        options={[
          { id: 'projects', label: pmT('Projects') },
          { id: 'subprojects', label: pmT('Subprojects') },
          { id: 'all', label: pmT('All') },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { marginLeft: 4 } });
