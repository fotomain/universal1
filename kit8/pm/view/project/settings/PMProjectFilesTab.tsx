// PMProjectFilesTab - "Files" tab of the Project settings window (TabFiles, after TabPayments): the switch of the file attachments of the project and the Google Drive connection of the
// organization (kit8/files, documentation/FILE_ATTACHMENT_WBS.html).
//   project_table.rowJSON.filesFunctionalityEnabled   TRUE while never saved (the database reads a missing value as true). OFF: the tab Files of the tasks, the tree column and the Add actions are hidden;
//                                                     the files and the rows stay.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import FilesDriveBlock from '../../../../files/FilesDriveBlock';
import PMTaskFilesPanel from '../../../../files/PMTaskFilesPanel';
import { filesEnabledOfProject } from '../../../../files/fileModel';
import { pmT } from '../../../i18n/pmT';

export interface PMProjectFilesValues {
  filesFunctionalityEnabled?: boolean;
}

/** a missing value is TRUE */
export const filesValuesOf = (j: PMProjectFilesValues | undefined | null): Required<PMProjectFilesValues> => ({ filesFunctionalityEnabled: filesEnabledOfProject(j) });

/** projectGUID: the project of the window (absent = the Organization defaults: only the organization files are offered) */
export default function PMProjectFilesTab({ values, onChange, projectGUID }: { values: PMProjectFilesValues; onChange: (patch: PMProjectFilesValues) => void; projectGUID?: string | null }) {
  const v = filesValuesOf(values);
  const [open, setOpen] = useState<null | 'project' | 'organization'>(null);
  return (
    <View testID="pm-project-tab-files-content">
      <SwitchApp
        testID="pm-project-files-enabled"
        label={pmT('Files functionality (filesFunctionalityEnabled)')}
        value={v.filesFunctionalityEnabled}
        onValueChange={(on) => onChange({ filesFunctionalityEnabled: on })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{pmT('On (default): the tasks of the project have the tab Files. Off: the tab and the Add actions are hidden; the files stay where they are.')}</Text>
      <FilesDriveBlock />
      <View style={styles.openRow}>
        {projectGUID ? (
          <Pressable testID="pm-project-files-open-project" onPress={() => setOpen(open === 'project' ? null : 'project')} style={styles.openButton}>
            <Text>{pmT('Project files')}</Text>
          </Pressable>
        ) : null}
        <Pressable testID="pm-project-files-open-organization" onPress={() => setOpen(open === 'organization' ? null : 'organization')} style={styles.openButton}>
          <Text>{pmT('Organization files')}</Text>
        </Pressable>
      </View>
      {open ? (
        <View style={styles.panel}>
          <PMTaskFilesPanel scope={open} projectGUID={projectGUID || ''} taskGUID="" testID={`pm-project-files-${open}`} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  switchRow: { marginVertical: 4 },
  hint: { fontSize: 12, opacity: 0.7, marginBottom: 4 },
  openRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  openButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#8884' },
  panel: { minHeight: 240, maxHeight: 420, marginTop: 8 },
});
