// PMProjectFilesTab - "Files" tab of the Project settings window (TabFiles, after TabPayments): the switch of the file attachments of the project, the STORAGE of its files and the connection of the
// organization to that storage (kit8/files, documentation/FILE_ATTACHMENT_WBS.html, documentation/FILE_WITH_OneDrive_WBS.html).
//   project_table.rowJSON.filesFunctionalityEnabled      TRUE while never saved (the database reads a missing value as true). OFF: the tab Files of the tasks, the tree column and the Add actions are hidden;
//                                                        the files and the rows stay.
//   project_table.rowJSON.projectFilesStorageProvider    'googleDrive' | 'oneDrive' - where the NEW files of the project go; a missing value = googleDrive. The radio set is enabled only while the
//                                                        switch above is on. A file keeps the storage it was made in (its row says it); a change moves nothing.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { ModalAskComponent } from '../../../../ui/components/common/ModalAskComponent';
import FilesDriveBlock from '../../../../files/FilesDriveBlock';
import FilesStorageProviderRadio from '../../../../files/FilesStorageProviderRadio';
import PMTaskFilesPanel from '../../../../files/PMTaskFilesPanel';
import { countFilesForDelete } from '../../../../files/filesDriveApi';
import { driveStateText, filesEnabledOfProject, filesProviderOfProject, providerTitleOf, type FileStorageProvider } from '../../../../files/fileModel';
import { useAllDriveStatus } from '../../../../files/useFiles';
import { pmT } from '../../../i18n/pmT';

export interface PMProjectFilesValues {
  filesFunctionalityEnabled?: boolean;
  projectFilesStorageProvider?: FileStorageProvider;
}

/** a missing filesFunctionalityEnabled is TRUE, a missing projectFilesStorageProvider is googleDrive */
export const filesValuesOf = (j: PMProjectFilesValues | undefined | null): Required<PMProjectFilesValues> => ({ filesFunctionalityEnabled: filesEnabledOfProject(j), projectFilesStorageProvider: filesProviderOfProject(j) });

/** projectGUID: the project of the window (absent = the Organization defaults: only the organization files are offered, and a change needs no question) */
export default function PMProjectFilesTab({ values, onChange, projectGUID }: { values: PMProjectFilesValues; onChange: (patch: PMProjectFilesValues) => void; projectGUID?: string | null }) {
  const v = filesValuesOf(values);
  const [open, setOpen] = useState<null | 'project' | 'organization'>(null);
  const [asking, setAsking] = useState<{ next: FileStorageProvider; count: number } | null>(null);
  const { all } = useAllDriveStatus(v.filesFunctionalityEnabled);
  const other: FileStorageProvider = v.projectFilesStorageProvider === 'oneDrive' ? 'googleDrive' : 'oneDrive';
  const notConfigured = (['googleDrive', 'oneDrive'] as FileStorageProvider[]).filter((p) => all?.[p]?.providerConfigured === false);

  const choose = async (next: FileStorageProvider) => {
    if (next === v.projectFilesStorageProvider) return;
    // a project with files: say what stays where (nothing is moved) before the choice is taken
    if (projectGUID) {
      const r = await countFilesForDelete('project', projectGUID);
      const count = r.ok ? Number(r.data) || 0 : 0;
      if (count > 0) { setAsking({ next, count }); return; }
    }
    onChange({ projectFilesStorageProvider: next });
  };

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
      <FilesStorageProviderRadio value={v.projectFilesStorageProvider} disabled={!v.filesFunctionalityEnabled} notConfigured={notConfigured} onChange={choose} />
      <Text style={styles.hint}>{pmT('New files of this project are stored in the chosen storage. A file stays in the storage it was made in; nothing is moved when you change this.')}</Text>
      <FilesDriveBlock provider={v.projectFilesStorageProvider} />
      {all ? (
        <Text testID="pm-project-files-other-state" style={styles.hint}>{pmT(driveStateText(all[other].state, all[other].accountEmail, other))}</Text>
      ) : null}
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
          <PMTaskFilesPanel scope={open} projectGUID={projectGUID || ''} taskGUID="" provider={open === 'project' ? v.projectFilesStorageProvider : undefined} testID={`pm-project-files-${open}`} />
        </View>
      ) : null}
      <ModalAskComponent
        testID="pm-project-files-provider-ask"
        visible={!!asking}
        modalTopBar={pmT('Change the files storage?')}
        modalBody={asking ? pmT('{{n}} files stay in {{from}}. New files will be stored in {{to}}.', { n: asking.count, from: providerTitleOf(v.projectFilesStorageProvider), to: providerTitleOf(asking.next) }) : ''}
        cancelLabel={pmT('Cancel')}
        confirmLabel={pmT('Change')}
        onCancel={() => setAsking(null)}
        onConfirm={() => { const next = asking?.next; setAsking(null); if (next) onChange({ projectFilesStorageProvider: next }); }}
      />
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
