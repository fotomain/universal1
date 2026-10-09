// ProjectVersionCard - one saved version in PMProjectVersionsList:
//   [ (✓) round check box ]  title · "Version 3 · 2026-10-02 14:05 · 8 rows" · differences to the live project
//   [ Restore from version ] [ rename ] [ sql_for_delete ]
// The check box (same round look as the CRUD list cards) = "draw this version on the Gantt chart";
// a checked version shows the color of its bars.

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import IconApp from '../../../../ui/components/common/IconApp';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../../view/theme';
import { PMDialogButton } from '../../../inner/buttons/PMDialogButton';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { compareVersionWithCurrent, describeVersionDiff, scheduleVersion } from '../../model/versionCompare';
import { formatVersionDateTime, PMProjectVersionRow } from '../../model/versionTypes';
import { useVersionDataQuery } from '../../crud/version/versionQueries';
import { pmT } from '../../../i18n/pmT';

export interface ProjectVersionCardProps {
  version: PMProjectVersionRow;
  checked: boolean;
  /** color of the version's bars on the Gantt (checked versions only) */
  color?: string;
  palette: PMPalette;
  disabled?: boolean;
  onToggleChecked: (versionGUID: string) => void;
  onRestore: (versionGUID: string) => void;
  onRename: (versionGUID: string) => void;
  onDelete: (versionGUID: string) => void;
}

export default function ProjectVersionCard({ version, checked, color, palette, disabled, onToggleChecked, onRestore, onRename, onDelete }: ProjectVersionCardProps) {
  const id = version.rowVersionGUID;
  const j = version.rowJSON;
  const dataQuery = useVersionDataQuery(id);
  const schedule = usePMStore((s) => s.schedule);
  const tasksById = usePMStore((s) => s.tasksById);
  const projectFinishMs = usePMStore((s) => s.projectFinishMs);

  const diffText = useMemo(() => {
    if (!dataQuery.data) return null;
    const s = scheduleVersion(version, dataQuery.data);
    return describeVersionDiff(compareVersionWithCurrent(s.bars, s.finishMs, { schedule, tasksById, projectFinishMs }));
  }, [dataQuery.data, version, schedule, tasksById, projectFinishMs]);

  const number = j.versionNumber ?? version.orderInList;
  const rows = j.versionTaskCount;
  const meta = `Version ${number} · ${formatVersionDateTime(j.versionCreatedAt)}${rows != null ? ` · ${rows} ${rows === 1 ? 'row' : 'rows'}` : ''}`;

  return (
    <View
      testID={`pm-version-card-${id}`}
      style={[styles.card, { backgroundColor: checked ? palette.selected : palette.surface, borderColor: checked ? color || palette.primary : palette.border }]}
    >
      <Pressable
        testID={`pm-version-check-${id}`}
        onPress={() => onToggleChecked(id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        aria-checked={checked}
        accessibilityLabel={checked ? `Hide version ${j.versionTitle} on the Gantt chart` : `Show version ${j.versionTitle} on the Gantt chart`}
        hitSlop={6}
        style={[styles.roundCheckbox, checked ? { backgroundColor: palette.primary, borderColor: palette.primary } : { borderColor: palette.primary, backgroundColor: 'transparent' }]}
      >
        <IconApp name="check" size={16} color={checked ? '#ffffff' : 'transparent'} />
      </Pressable>

      <View style={styles.main}>
        <View style={styles.titleRow}>
          {checked && !!color && <View testID={`pm-version-color-${id}`} style={[styles.swatch, { backgroundColor: color }]} />}
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1} testID={`pm-version-title-${id}`}>
            {j.versionTitle}
          </Text>
        </View>
        <Text style={[styles.meta, { color: palette.textMuted }]} numberOfLines={1}>
          {meta}
        </Text>
        <Text style={[styles.diff, { color: palette.textMuted }]} numberOfLines={2} testID={`pm-version-diff-${id}`}>
          {diffText === null ? (dataQuery.isError ? 'Could not load the version rows' : 'Comparing with the project…') : `Compared with the project now: ${diffText}`}
        </Text>
      </View>

      <View style={styles.actions}>
        <PMDialogButton
          testID={`pm-version-card-restore-${id}`}
          kind="secondary"
          icon="settings_backup_restore"
          title={pmT('Restore from version')}
          disabled={disabled}
          onPress={() => onRestore(id)}
        />
        <PMIconButton testID={`pm-version-card-rename-${id}`} icon="edit" title={pmT('Rename version')} color={palette.text} disabled={disabled} onPress={() => onRename(id)} />
        <PMIconButton testID={`pm-version-card-delete-${id}`} icon="delete" title={pmT('Delete version')} color={palette.error} disabled={disabled} onPress={() => onDelete(id)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10 },
  // same round check box as the CRUD list cards (ListWebCardsComponent)
  roundCheckbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  main: { flex: 1, minWidth: 180 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  swatch: { width: 22, height: 6, borderRadius: 3, marginRight: 8 },
  title: { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  meta: { fontSize: 12, marginTop: 2 },
  diff: { fontSize: 12, marginTop: 3 },
  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
});
