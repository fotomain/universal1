// FilesTable - the list of the Files panel (kit8/files) as a ReusableTable in LOCAL ROWS mode: the rows are the files of ONE scope read by the `files_list` RPC (PMTaskFilesPanel holds them), so the
// table has no Supabase table / redux entity of its own, and nothing is written by it (readOnly: no cell edit, no add / duplicate / delete / move of a table row, no row menu - every change of a
// file is an RPC of the panel: Replace, Move, Edit, Delete). Columns: kind icon · Name · Size · the action buttons of the row · Details (document type, paper place, version).
// The search field and the empty texts belong to the panel (it filters the rows by name before they come here).
import React, { useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import ReusableTable from '../../ui/components/table/reusable/ReusableTable';
import type { ReusableTableRow, VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import { pmT } from '../../pm/i18n/pmT';
import { PMIconButton } from '../../pm/inner/buttons/PMIconButton';
import { FILE_KIND_ICON, fileKindOf, fileProviderOfRow, fileTitleOf, formatBytes, isLinkRow, providerTitleOf, type FileRow } from './fileModel';

export interface FilesTableActions {
  onView: (row: FileRow) => void;
  onReplace: (row: FileRow) => void;
  onMove: (row: FileRow) => void;
  onEdit: (row: FileRow) => void;
  onDelete: (row: FileRow) => void;
  /** show / hide the older versions of a replaced file */
  onVersions: (row: FileRow) => void;
}

export interface FilesTableProps extends FilesTableActions {
  /** the rows to show (already filtered by the search); keep the array stable (useMemo) */
  rows: FileRow[];
  /** the document types (title of `fileDocumentTypeGUID`) */
  types: { rowGUID: string; rowJSON: { title: string } }[];
  /** the list holds files of more than one storage: every row says where its file is */
  showProvider?: boolean;
  /** the holder of projectMediaPostManager: Replace / Move / Edit / Delete are shown */
  canChange: boolean;
  testID?: string;
}

const typeTitleOf = (types: FilesTableProps['types'], guid?: string): string => (guid ? types.find((t) => t.rowGUID === guid)?.rowJSON.title || '' : '');

/** the text of the Details column: document type · paper place · version (only what exists) */
export function fileDetailsOf(row: FileRow, types: FilesTableProps['types'], showProvider = false): string {
  const j = row.rowJSON;
  // the storage of the file, only while the list holds files of more than one storage (the project changed its storage)
  return [showProvider && !isLinkRow(row) ? providerTitleOf(fileProviderOfRow(row)) : '', typeTitleOf(types, j.fileDocumentTypeGUID), j.paperDocumentPlace ? `${pmT('Paper')}: ${j.paperDocumentPlace}` : '', (j.fileVersionNumber || 1) > 1 ? `v${j.fileVersionNumber}` : ''].filter(Boolean).join('  ·  ');
}

const BUTTON_W = 34;

export default function FilesTable({ rows, types, canChange, showProvider = false, testID = 'task-files', onView, onReplace, onMove, onEdit, onDelete, onVersions }: FilesTableProps) {
  const { themeColors: c } = useDesignSystem();
  // the handlers change every render of the panel: the columns read them through a ref, so the columns (and the table) stay stable
  const h = useRef<FilesTableActions>({ onView, onReplace, onMove, onEdit, onDelete, onVersions });
  h.current = { onView, onReplace, onMove, onEdit, onDelete, onVersions };

  const localRows = useMemo<ReusableTableRow[]>(() => rows.map((r, i) => ({ rowGUID: r.rowGUID, rowOwnerGUID: r.rowOwnerGUID, rowParentGUID: r.rowParentGUID, orderInList: r.orderInList ?? i, rowJSON: r.rowJSON })), [rows]);
  const byGuid = useMemo(() => new Map(rows.map((r) => [r.rowGUID, r])), [rows]);

  const columns = useMemo<VisualColumn[]>(() => {
    const fileOf = (row: ReusableTableRow): FileRow => byGuid.get(row.rowGUID) || (row as unknown as FileRow);
    const buttons = canChange ? 6 : 2;
    return [
      {
        key: 'kind', title: pmT('Kind'), type: 'custom', width: 56, align: 'center',
        renderCell: (row) => {
          const f = fileOf(row);
          const kind = f.rowJSON.fileKind || fileKindOf(f.rowJSON.mediaPostMIME, f.rowJSON.fileName);
          return <IconApp name={isLinkRow(f) ? 'link' : FILE_KIND_ICON[kind]} size={22} color={c.primary} testID={`${testID}-kind-${f.rowGUID}`} />;
        },
      },
      {
        key: 'name', title: pmT('Name'), type: 'custom', width: 230,
        searchText: (row) => fileTitleOf(fileOf(row)),
        renderCell: (row) => <Text testID={`${testID}-name-${row.rowGUID}`} numberOfLines={1} style={{ flex: 1, color: c.text, fontSize: 14, fontWeight: '600' }}>{fileTitleOf(fileOf(row))}</Text>,
      },
      {
        key: 'size', title: pmT('Size'), type: 'custom', width: 80, align: 'right',
        renderCell: (row) => <Text testID={`${testID}-size-${row.rowGUID}`} numberOfLines={1} style={{ flex: 1, color: c.text, opacity: 0.8, fontSize: 13, textAlign: 'right' }}>{formatBytes(fileOf(row).rowJSON.fileSizeBytes)}</Text>,
      },
      {
        key: 'actions', title: pmT('Actions'), type: 'custom', width: buttons * BUTTON_W + 16,
        renderCell: (row) => {
          const f = fileOf(row);
          const id = f.rowGUID;
          const link = isLinkRow(f);
          return (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              {(f.rowJSON.fileVersionNumber || 1) > 1 ? (
                <PMIconButton tipScope="app" testID={`${testID}-versions-button-${id}`} icon="history" title={pmT('Show / hide the older versions')} color={c.text} onPress={() => h.current.onVersions(f)} />
              ) : null}
              <PMIconButton tipScope="app" testID={`${testID}-view-${id}`} icon="open_in_new" title={pmT('View the file (opens it in a new tab)')} color={c.text} onPress={() => h.current.onView(f)} />
              {canChange ? (
                <>
                  {!link ? <PMIconButton tipScope="app" testID={`${testID}-replace-${id}`} icon="upload_file" title={pmT('Replace with a new version (the old one is kept)')} color={c.text} onPress={() => h.current.onReplace(f)} /> : null}
                  <PMIconButton tipScope="app" testID={`${testID}-move-${id}`} icon="drive_file_move" title={pmT('Move to the project or the organization files')} color={c.text} onPress={() => h.current.onMove(f)} />
                  <PMIconButton tipScope="app" testID={`${testID}-edit-${id}`} icon="edit" title={pmT('Edit the name, the type and the paper place')} color={c.text} onPress={() => h.current.onEdit(f)} />
                  <PMIconButton tipScope="app" testID={`${testID}-delete-${id}`} icon="delete" title={pmT('Delete the file from its storage permanently')} color={c.error} onPress={() => h.current.onDelete(f)} />
                </>
              ) : null}
            </View>
          );
        },
      },
      {
        key: 'details', title: pmT('Details'), type: 'custom', width: 230,
        searchText: (row) => fileDetailsOf(fileOf(row), types, showProvider),
        renderCell: (row) => <Text testID={`${testID}-details-${row.rowGUID}`} numberOfLines={1} style={{ flex: 1, color: c.text, opacity: 0.75, fontSize: 12 }}>{fileDetailsOf(fileOf(row), types, showProvider)}</Text>,
      },
    ];
  }, [byGuid, types, canChange, showProvider, c.primary, c.text, c.error, testID]);

  return (
    <ReusableTable
      testID={`${testID}-table`}
      entityName="filesPanelList"
      crudListTitle={pmT('Files')}
      itemLabel={pmT('File')}
      localRows={localRows}
      visualColumns={columns}
      readOnly
      selectionEnabled={false}
      crudPanelEnabled={false}
      addEnabled={false}
      deleteEnabled={false}
      reorderEnabled={false}
      contextMenuEnabled={false}
      searchEnabled={false}
      columnSortAndFilter
    />
  );
}
