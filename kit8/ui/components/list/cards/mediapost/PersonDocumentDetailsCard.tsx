// PersonDocumentDetailsCard - the READ ONLY details of a person's ID card / passport post: the owner photo, the name, the document and EVERY datum, in a window over the list.
// Opens on a double click / double touch of the card (ReusableCardMediaPost). Nothing here is editable: no input, no save. Top row: Close at the LEFT, the three dots menu at the RIGHT = Export / Share of ALL the data (JSON, CSV, PDF).
import React, { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReusableTableRow } from '../../../table/reusable/reusableTableTypes';
import { PMIconButton } from '../../../../../pm/inner/buttons/PMIconButton';
import PMContextMenu, { PM_MENU_WIDTH } from '../../../../../pm/inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../../../../../pm/inner/menu/PMMenuItem';
import { showSnackbar } from '../../../../../redux/uxuiSlice';
import { buildTableFile, exportTableFile, shareTableFile, TABLE_EXPORT_FORMATS, TableExportFormat, tableFileResultMessage } from '../../../table/reusable/tableExportActions';
import { menuLeft, MenuAnchorPoint, useMenuAnchor } from '../../reusable/useMenuAnchor';
import { exportFileName } from '../../../table/reusable/tableExport';
import { buildPersonDocumentPdf } from './personDocumentPdf';
import { PERSON_DOCUMENT_EXPORT_COLUMNS, personDocumentDetails, personDocumentExportRows, personDocumentExportTitle } from './personDocumentModel';

/** one PDF entry: the page of the document is the same for "full" and "visible" */
const EXPORT_FORMATS = TABLE_EXPORT_FORMATS.filter((f) => f.format !== 'pdfVisible').map((f) => (f.format === 'pdfFull' ? { ...f, label: 'to PDF (with photo)' } : f));

export interface PersonDocumentDetailsCardProps {
  row: ReusableTableRow;
  onClose: () => void;
  testID?: string;
}

export default function PersonDocumentDetailsCard({ row, onClose, testID = 'person-document' }: PersonDocumentDetailsCardProps) {
  const theme = useTheme();
  const d = useMemo(() => personDocumentDetails(row), [row]);
  const dispatch = useDispatch();
  const [menuAt, setMenuAt] = useState<MenuAnchorPoint | null>(null);
  const dots = useMenuAnchor(setMenuAt);
  // Export / Share of ALL the data: the same formats and the same file actions as the More menu of the lists
  const runFile = async (format: TableExportFormat, share: boolean) => {
    setMenuAt(null);
    try {
      const title = personDocumentExportTitle(d);
      // the PDF is the page of the document WITH the owner photo (the table PDF has no pictures); JSON and CSV are the table of the data
      const file = format === 'pdfFull' || format === 'pdfVisible'
        ? { fileName: exportFileName(title, 'pdf'), mimeType: 'application/pdf', bytes: buildPersonDocumentPdf(d) }
        : buildTableFile(format, { title, rows: personDocumentExportRows(d), columns: PERSON_DOCUMENT_EXPORT_COLUMNS, catalogTitle: () => '' });
      const result = share ? await shareTableFile(file, title) : await exportTableFile(file);
      const message = tableFileResultMessage(result, file.fileName);
      if (message) dispatch(showSnackbar({ message }));
    } catch (e: any) {
      dispatch(showSnackbar({ message: `${share ? 'Share' : 'Export'} failed: ${e?.message || e}` }));
    }
  };
  const menuItems: PMMenuItemProps[] = [
    { testID: `${testID}-menu-export`, label: 'Export all', icon: 'download', onPress: () => {}, submenu: EXPORT_FORMATS.map((f) => ({ testID: `${testID}-menu-export-${f.format}`, label: f.label, icon: f.icon, onPress: () => runFile(f.format, false) })) },
    { testID: `${testID}-menu-share`, label: 'Share all', icon: 'share', onPress: () => {}, submenu: EXPORT_FORMATS.map((f) => ({ testID: `${testID}-menu-share-${f.format}`, label: f.label, icon: f.icon, onPress: () => runFile(f.format, true) })) },
  ];
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} testID={`${testID}-modal`}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" testID={`${testID}-backdrop`} />
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]} testID={testID}>
          <View style={styles.top}>
            <IconButton icon="close" onPress={onClose} accessibilityLabel="Close" testID={`${testID}-close`} />
            <View style={styles.fill} />
            <View {...dots.anchorProps}>
              <PMIconButton testID={`${testID}-more`} icon="more_vert" title="More" onPress={dots.open} color={theme.colors.onSurface} />
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.photoBox, { backgroundColor: theme.colors.surfaceVariant }]}>
              {d.photoUri ? <Image source={{ uri: d.photoUri }} style={styles.photo} resizeMode="contain" testID={`${testID}-photo`} />
                : <MaterialCommunityIcons name={(d.kind === 'Passport' ? 'passport' : 'card-account-details') as any} size={56} color={theme.colors.onSurfaceVariant} />}
            </View>
            <Text variant="headlineSmall" style={styles.center} testID={`${testID}-name`}>{d.name || '—'}</Text>
            <Text variant="bodyLarge" style={[styles.center, { color: theme.colors.onSurfaceVariant }]} testID={`${testID}-kind`}>{`${d.kind}${d.number ? ` · No. ${d.number}` : ''}`}</Text>
            {d.created ? <Text variant="bodySmall" style={[styles.center, { color: theme.colors.onSurfaceVariant }]} testID={`${testID}-created`}>{`Post made ${d.created}`}</Text> : null}
            <View style={styles.fields}>
              {d.fields.map((f, i) => (
                <View key={`${f.label}-${i}`} style={[styles.field, { borderBottomColor: theme.colors.outlineVariant }]} testID={`${testID}-field-${i}`}>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>{f.label}</Text>
                  <Text variant="bodyLarge" selectable>{f.value}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          {menuAt ? <PMContextMenu testID={`${testID}-menu`} x={menuLeft(menuAt, PM_MENU_WIDTH)} y={menuAt.y} caption="All the data" items={menuItems} onClose={() => setMenuAt(null)} /> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '94%', borderRadius: 20, paddingTop: 4, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  fill: { flex: 1 },
  content: { padding: 16, paddingTop: 4, gap: 4 },
  center: { textAlign: 'center' },
  photoBox: { alignSelf: 'center', width: 168, height: 216, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8 },
  photo: { width: '100%', height: '100%' },
  fields: { marginTop: 12 },
  field: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
});
