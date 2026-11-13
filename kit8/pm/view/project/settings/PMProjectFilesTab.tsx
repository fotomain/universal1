// PMProjectFilesTab - "Files" tab of the Project settings window (TabFiles, after TabPayments): the switch of the file attachments of the project
// (kit8/files, documentation/FILE_ATTACHMENT_WBS.html).
//   project_table.rowJSON.filesFunctionalityEnabled      TRUE while never saved (the database reads a missing value as true). OFF: the tab Files of the tasks, the tree column and the Add actions are hidden;
//                                                        the files and the rows stay.
// The STORAGE of the files (Google Drive | Microsoft OneDrive) and its connection are NOT per project: they belong to the whole organization (Organization edit -> Files,
// kit8/files/common/OrganizationFilesTab.tsx). This tab only says so and opens the files of the project in the storage of the organization.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import PMTaskFilesPanel from '../../../../files/common/PMTaskFilesPanel';
import { filesEnabledOfProject, type FileStorageProvider } from '../../../../files/common/fileModel';
import { pmT } from '../../../i18n/pmT';

export interface PMProjectFilesValues {
  filesFunctionalityEnabled?: boolean;
}

/** a missing filesFunctionalityEnabled is TRUE */
export const filesValuesOf = (j: PMProjectFilesValues | undefined | null): Required<PMProjectFilesValues> => ({ filesFunctionalityEnabled: filesEnabledOfProject(j) });

/** projectGUID: the project of the window (absent = the Organization defaults: no project files to open); provider: the storage of the organization (shown in the panel) */
export default function PMProjectFilesTab({ values, onChange, projectGUID, provider = 'googleDrive' }: { values: PMProjectFilesValues; onChange: (patch: PMProjectFilesValues) => void; projectGUID?: string | null; provider?: FileStorageProvider }) {
  const v = filesValuesOf(values);
  const [open, setOpen] = useState(false);

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
      <Text testID="pm-project-files-storage-note" style={styles.hint}>{pmT('The storage of the files (Google Drive or Microsoft OneDrive) and its connection are the same for all projects of the organization: Organization edit -> Files.')}</Text>
      {projectGUID ? (
        <View style={styles.openRow}>
          <Pressable testID="pm-project-files-open-project" onPress={() => setOpen((o) => !o)} style={styles.openButton}>
            <Text>{pmT('Project files')}</Text>
          </Pressable>
        </View>
      ) : null}
      {open && projectGUID ? (
        <View style={styles.panel}>
          <PMTaskFilesPanel scope="project" projectGUID={projectGUID} taskGUID="" provider={provider} testID="pm-project-files-project" />
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
