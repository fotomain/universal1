// EstimationProjectPicker - what the Estimation dashboard shows while no project is chosen (and behind "Change project"): the user's projects of the active organization to pick
// from, and the form that MAKES a new project for the estimation (name + Create). A new project gets the default settings of the organization and its business units, like the
// New project window; the estimate documents then live in it. The dashboard keeps the picked project in its own state (no task rows are loaded for it).
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { useActiveOrganizationGUID } from '../../../catalog/organization/switch/useActiveOrganizationGUID';
import { projectsOfOrganization } from '../../../catalog/organization/switch/organizationSwitchModel';
import { useMyOrganization } from '../../../catalog/organization/useMyOrganization';
import { newProjectPatchFrom } from '../../../catalog/organization/defaultProjectSettings';
import { useBusinessUnitData } from '../../../catalog/business_unit/useBusinessUnitData';
import { defaultProjectCenters } from '../../../catalog/business_unit/businessUnitModel';
import { usePermissions } from '../../../permissions/usePermissions';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import { usePMOwnerGUID } from '../../crud/queries';
import { useBuildProjectRow, useCreateProjectMutation, useReadProjectsQuery } from '../../crud/project/projectQueries';
import { pmT } from '../../i18n/pmT';
import { PMDialogButton } from '../../inner/buttons/PMDialogButton';

export interface EstimationProjectPickerProps {
  onPicked: (projectGUID: string) => void;
  /** a project is open already: the picker can be closed */
  onCancel?: () => void;
  testID?: string;
}

/** the name offered for a new estimation project: "Estimation", "Estimation 2", ... that no project of the user has */
export function suggestEstimationName(existing: readonly string[], base: string): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
  return `${base} ${Date.now()}`;
}

export default function EstimationProjectPicker({ onPicked, onCancel, testID = 'estimation-picker' }: EstimationProjectPickerProps) {
  const { themeColors: c } = useDesignSystem();
  const ownerGUID = usePMOwnerGUID();
  const organizationGUID = useActiveOrganizationGUID();
  const projects = useReadProjectsQuery(ownerGUID);
  const organization = useMyOrganization();
  const units = useBusinessUnitData(true);
  const buildRow = useBuildProjectRow(ownerGUID);
  const createProject = useCreateProjectMutation(ownerGUID);
  const perms = usePermissions(null);
  const list = useMemo(() => projectsOfOrganization(projects.data || [], organizationGUID), [projects.data, organizationGUID]);
  const names = useMemo(() => list.map((p) => String(p.rowJSON?.name ?? '')).filter(Boolean), [list]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shownName = name || suggestEstimationName(names, pmT('Estimation'));
  const canCreate = perms.canCreateProject !== false;

  const create = async () => {
    const finalName = shownName.trim();
    if (!finalName) { setError(pmT('Type a name for the project.')); return; }
    setBusy(true); setError('');
    try {
      const row = buildRow(finalName);
      Object.assign(row.rowJSON, newProjectPatchFrom(organization.defaults), defaultProjectCenters(units.rows, units.cfrRows), { projectBusinessUnitsRequired: true });
      await createProject.mutateAsync(row);
      onPicked(row.rowGUID);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView testID={testID} style={styles.root} contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 30 }}>
      <Text style={[styles.h, { color: c.text }]}>{pmT('New project for the estimation')}</Text>
      <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('The estimates are kept in a project. Make a new one here, or pick one of your projects below.')}</Text>
      <View style={styles.row}>
        <View style={{ width: 360, maxWidth: '100%' }}>
          <TextInputApp testID={`${testID}-name`} label={pmT('Project name')} value={shownName} disabled={busy || !canCreate} onChangeText={setName} />
        </View>
        <PMDialogButton testID={`${testID}-create`} kind="primary" icon="add" title={pmT('Create project')} disabled={busy || !canCreate} onPress={() => { void create(); }} />
        {!!onCancel && <PMDialogButton testID={`${testID}-cancel`} kind="secondary" title={pmT('Cancel')} disabled={busy} onPress={onCancel} />}
      </View>
      {!canCreate && <Text testID={`${testID}-no-right`} style={{ color: c.error, fontSize: 12 }}>{pmT('You may not create projects in this organization. Pick one of your projects below.')}</Text>}
      {!!error && <Text testID={`${testID}-error`} style={{ color: c.error, fontSize: 12 }}>{error}</Text>}

      <Text style={[styles.h, { color: c.text, marginTop: 8 }]}>{pmT('Your projects')}</Text>
      {projects.isLoading ? (
        <Text style={{ color: c.text, opacity: 0.7 }}>{pmT('Reading...')}</Text>
      ) : !list.length ? (
        <Text testID={`${testID}-empty`} style={{ color: c.text, opacity: 0.7 }}>{pmT('No projects yet.')}</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {list.map((p) => (
            <Pressable key={p.rowGUID} testID={`${testID}-project-${p.rowGUID}`} disabled={busy} onPress={() => onPicked(p.rowGUID)} style={[styles.item, { borderColor: c.border, backgroundColor: c.surface }]}>
              <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={1}>{String(p.rowJSON?.name ?? p.rowGUID)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  h: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  item: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
});
