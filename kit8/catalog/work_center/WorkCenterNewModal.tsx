// WorkCenterNewModal - the window that makes a work center: a kind (Person | Equipment | Partner), the catalog item it stands for (a free one of that kind), a business unit (the
// folder), a title (optional: the name of the base) and a calendar (optional). The same rules as the SQL trigger (validateWorkCenter), so a refusal shows here before the server says it.
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import ButtonApp from '../../ui/components/common/ButtonApp';
import SelectItemFromListApp from '../../ui/components/common/SelectItemFromListApp';
import TextInputApp from '../../ui/components/common/TextInputApp';
import { newWorkCenterJSON, validateWorkCenter, WORK_CENTER_KINDS, workCenterBaseOptions, workCenterKindLabel, workCenterUnitOptions } from './workCenterModel';
import type { WorkCenterCatalogData, WorkCenterKind, WorkCenterRowJSON } from './workCenterModel';

export interface WorkCenterNewModalProps {
  visible: boolean;
  data: WorkCenterCatalogData;
  /** the business unit preselected (the folder picked in the tree) */
  initialUnit?: string | null;
  /** the resource calendars as select options (empty list = no calendar field) */
  calendarOptions?: { value: string; label: string }[];
  onCancel: () => void;
  /** the work center to create: the folder (= business unit) and its rowJSON */
  onCreate: (rowParentGUID: string, rowJSON: WorkCenterRowJSON) => void;
  testID?: string;
}

export default function WorkCenterNewModal({ visible, data, initialUnit, calendarOptions = [], onCancel, onCreate, testID = 'work-center-new' }: WorkCenterNewModalProps) {
  const { themeColors: c } = useDesignSystem();
  const [kind, setKind] = useState<WorkCenterKind | null>(null);
  const [base, setBase] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(initialUnit ?? null);
  const [title, setTitle] = useState('');
  const [calendar, setCalendar] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const unitOptions = useMemo(() => workCenterUnitOptions(data.businessUnit), [data.businessUnit]);
  const baseOptions = useMemo(() => workCenterBaseOptions(data, kind), [data, kind]);
  const draft = { workCenterKind: kind, workCenterBase: base, businessUnit: unit };
  const errors = validateWorkCenter(draft, data);
  const shown = tried ? errors : {};

  const create = () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    onCreate(unit as string, newWorkCenterJSON({ kind: kind as WorkCenterKind, base: base as string, businessUnit: unit as string, title, resourceCalendar: calendar }));
  };
  const pickKind = (k: WorkCenterKind) => { setKind(k); setBase(null); };

  if (!visible) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable testID={`${testID}-backdrop`} style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View testID={testID} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.h1, { color: c.text }]}>New work center</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
            <Text style={[styles.label, { color: c.text }]}>Kind</Text>
            <View style={styles.kinds}>
              {WORK_CENTER_KINDS.map((k) => (
                <Pressable key={k.value} testID={`${testID}-kind-${k.value}`} onPress={() => pickKind(k.value)}
                  style={[styles.kind, { borderColor: kind === k.value ? c.primary : c.border, backgroundColor: kind === k.value ? c.primary + '22' : 'transparent' }]}>
                  <Text style={{ color: kind === k.value ? c.primary : c.text, fontWeight: '700' }}>{k.label}</Text>
                </Pressable>
              ))}
            </View>
            {!!shown.workCenterKind && <Text testID={`${testID}-error-kind`} style={[styles.error, { color: c.error }]}>{shown.workCenterKind}</Text>}

            <SelectItemFromListApp
              testID={`${testID}-base`}
              label={kind ? workCenterKindLabel(kind) : 'Catalog item'}
              items={baseOptions}
              value={base}
              onSelect={setBase}
              disabled={!kind}
              placeholder={kind ? `Select ${workCenterKindLabel(kind).toLowerCase()}…` : 'Choose the kind first'}
              style={styles.field}
            />
            {kind === 'partner' && <Text style={[styles.hint, { color: c.text }]}>Only a partner that is a supplier can have a work center.</Text>}
            {!!kind && baseOptions.length === 0 && <Text testID={`${testID}-no-base`} style={[styles.hint, { color: c.text }]}>No free {workCenterKindLabel(kind).toLowerCase()}: each one already has a work center.</Text>}
            {!!shown.workCenterBase && <Text testID={`${testID}-error-base`} style={[styles.error, { color: c.error }]}>{shown.workCenterBase}</Text>}

            <SelectItemFromListApp testID={`${testID}-unit`} label="Business unit (folder)" items={unitOptions} value={unit} onSelect={setUnit} placeholder="Select business unit…" style={styles.field} />
            {!!shown.businessUnit && <Text testID={`${testID}-error-unit`} style={[styles.error, { color: c.error }]}>{shown.businessUnit}</Text>}

            <TextInputApp testID={`${testID}-title`} label="Title (empty = the name of the catalog item)" value={title} onChangeText={setTitle} />
            {calendarOptions.length > 0 && (
              <SelectItemFromListApp testID={`${testID}-calendar`} label="Calendar (empty = Standard work week)" items={calendarOptions} value={calendar} onSelect={setCalendar} placeholder="Standard work week" style={styles.field} clearable />
            )}
          </ScrollView>
          <View style={styles.actions}>
            <ButtonApp testID={`${testID}-cancel`} title="Cancel" variant="outlined" onPress={onCancel} />
            <ButtonApp testID={`${testID}-create`} title="Create" onPress={create} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 480, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 8 },
  h1: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  label: { fontSize: 12, opacity: 0.7, marginTop: 6, marginBottom: 4 },
  kinds: { flexDirection: 'row', gap: 8 },
  kind: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  field: { marginTop: 8 },
  hint: { fontSize: 12, opacity: 0.65, marginTop: 4 },
  error: { fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
});
