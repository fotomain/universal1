// OrganizationFilesTab - the tab "Files" of Organization edit (after Time sheet): the STORAGE of the files of ALL projects of the organization and its connection
// (kit8/files, documentation/FILE_ATTACHMENT_WBS.html, documentation/FILE_WITH_OneDrive_WBS.html). It was in Project settings -> Files, per project.
//   organizationTable.rowJSON.organizationFilesStorageProvider   'googleDrive' | 'oneDrive' - where the NEW files of every project go; a missing value = googleDrive.
//                                                                A file keeps the storage it was made in (its row says it); a change moves nothing. Saved with the Save button of the form.
//   the block below the radio: the connection of THAT storage (Connect / Reconnect / Disconnect, storage used, Check files) - acts at once, one account for the whole organization.
// The per-project switch filesFunctionalityEnabled stays in Project settings -> Files.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ModalAskComponent } from '../../ui/components/common/ModalAskComponent';
import { pmT } from '../../pm/i18n/pmT';
import FilesDriveBlock from './FilesDriveBlock';
import FilesStorageProviderRadio from './FilesStorageProviderRadio';
import PMTaskFilesPanel from './PMTaskFilesPanel';
import { countFilesForDelete } from './filesDriveApi';
import { driveStateText, providerTitleOf, type FileStorageProvider } from './fileModel';
import { useAllDriveStatus } from './useFiles';

export interface OrganizationFilesTabProps {
  value: FileStorageProvider;
  onChange: (next: FileStorageProvider) => void;
  /** the user cannot change the organization (not its administrator) */
  disabled?: boolean;
  /** a new, not yet saved organization has no connection to show */
  saved?: boolean;
}

export default function OrganizationFilesTab({ value, onChange, disabled = false, saved = true }: OrganizationFilesTabProps) {
  const [asking, setAsking] = useState<{ next: FileStorageProvider; count: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const { all } = useAllDriveStatus(saved);
  const other: FileStorageProvider = value === 'oneDrive' ? 'googleDrive' : 'oneDrive';
  const notConfigured = (['googleDrive', 'oneDrive'] as FileStorageProvider[]).filter((p) => all?.[p]?.providerConfigured === false);

  const choose = async (next: FileStorageProvider) => {
    if (next === value) return;
    // an organization with files: say what stays where (nothing is moved) before the choice is taken
    if (saved) {
      const r = await countFilesForDelete('organization');
      const count = r.ok ? Number(r.data) || 0 : 0;
      if (count > 0) { setAsking({ next, count }); return; }
    }
    onChange(next);
  };

  return (
    <View testID="organization-files-tab-content">
      <FilesStorageProviderRadio testID="files-storage-provider" value={value} disabled={disabled} notConfigured={notConfigured} onChange={choose} />
      <Text style={styles.hint}>{pmT('New files of ALL projects of the organization are stored in the chosen storage. A file stays in the storage it was made in; nothing is moved when you change this. Press Save to keep the choice.')}</Text>
      {saved ? (
        <>
          <FilesDriveBlock provider={value} />
          {all ? <Text testID="organization-files-other-state" style={styles.hint}>{pmT(driveStateText(all[other].state, all[other].accountEmail, other))}</Text> : null}
          <View style={styles.openRow}>
            <Pressable testID="organization-files-open" onPress={() => setPanelOpen((o) => !o)} style={styles.openButton}>
              <Text>{pmT('Organization files')}</Text>
            </Pressable>
          </View>
          {panelOpen ? (
            <View style={styles.panel}>
              <PMTaskFilesPanel scope="organization" projectGUID="" taskGUID="" provider={value} testID="organization-files-panel" />
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.hint}>{pmT('Save the organization first: then the storage can be connected here.')}</Text>
      )}
      <ModalAskComponent
        testID="organization-files-provider-ask"
        visible={!!asking}
        modalTopBar={pmT('Change the files storage?')}
        modalBody={asking ? pmT('{{n}} files stay in {{from}}. New files will be stored in {{to}}.', { n: asking.count, from: providerTitleOf(value), to: providerTitleOf(asking.next) }) : ''}
        cancelLabel={pmT('Cancel')}
        confirmLabel={pmT('Change')}
        onCancel={() => setAsking(null)}
        onConfirm={() => { const next = asking?.next; setAsking(null); if (next) onChange(next); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, opacity: 0.7, marginBottom: 4 },
  openRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  openButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#8884' },
  panel: { minHeight: 240, maxHeight: 420, marginTop: 8 },
});
