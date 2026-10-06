// KanbanEditCard - route /kanbanstage/edit (new) or /kanbanstage/edit?rowGUID=… (existing): one default Kanban
// stage of the catalog (kanban_stage_table): name, code, color, active (inactive stages are not copied into new
// projects). Live: the row follows Supabase Realtime - changed in another browser while this form is clean ->
// new values; with unsaved edits -> Reload / Keep mine; deleted elsewhere -> saving is blocked.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { ButtonPrimaryApp, ButtonTextApp, SwitchApp, TextInputApp } from '../../ui/components/common';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import { PM_KANBAN_ORDER_STEP, PM_KANBAN_STAGE_COLORS, PM_KANBAN_STAGE_NAME_MAX } from '../../pm/model/kanbanTypes';
import {
  emptyKanbanStage,
  KANBAN_STAGE_CATALOG_OWNER,
  KANBAN_STAGE_ENTITY,
  KANBAN_STAGE_READ_PARAMS,
  KANBAN_STAGE_ROUTES,
  kanbanStageCodeOf,
  KanbanStageErrors,
  KanbanStageRow,
  KanbanStageRowJSON,
  normalizeKanbanStage,
  validateKanbanStage,
} from './kanbanStageModel';

type Form = KanbanStageRowJSON;
const toForm = (j?: Partial<KanbanStageRowJSON>): Form => ({ ...emptyKanbanStage(), ...(j || {}), isActive: j?.isActive !== false });
const rowVersion = (r?: KanbanStageRow) => (r ? `${r.updated_at ?? ''}|${JSON.stringify(r.rowJSON)}` : '');

export default function KanbanEditCard() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const params = useLocalSearchParams<{ rowGUID?: string }>();
  const rowGUID = typeof params.rowGUID === 'string' && params.rowGUID ? params.rowGUID : null;
  const status = useRealtimeEntity(KANBAN_STAGE_ENTITY, { readParams: KANBAN_STAGE_READ_PARAMS });
  const actions = SystemMetaData[KANBAN_STAGE_ENTITY]?.actions;
  const rows: KanbanStageRow[] = useSelector((s: any) => s?.[KANBAN_STAGE_ENTITY]?.entityDataFromServer) || [];
  const loaded = useSelector((s: any) => s?.[KANBAN_STAGE_ENTITY]?.readSuccessful === 1);
  const row = useMemo(() => (rowGUID ? rows.find((r) => r.rowGUID === rowGUID) : undefined), [rows, rowGUID]);

  const [form, setForm] = useState<Form>(() => toForm(row?.rowJSON as any));
  const [codeTouched, setCodeTouched] = useState(!!rowGUID);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<KanbanStageErrors>({});
  const [remoteChanged, setRemoteChanged] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const seenVersion = useRef<string>('');
  const everSeen = useRef(false);

  // another stage / a new one: fresh form
  useEffect(() => {
    setForm(toForm(row?.rowJSON as any));
    setCodeTouched(!!rowGUID);
    setDirty(false);
    setErrors({});
    setRemoteChanged(false);
    setConfirmDelete(false);
    seenVersion.current = rowVersion(row);
    everSeen.current = !!row;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowGUID]);

  // realtime: the row changed on the server (this or another browser)
  useEffect(() => {
    if (!row) return;
    everSeen.current = true;
    const v = rowVersion(row);
    if (v === seenVersion.current) return;
    if (!seenVersion.current || !dirty) {
      seenVersion.current = v;
      setForm(toForm(row.rowJSON as any));
      setRemoteChanged(false);
    } else {
      setRemoteChanged(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  const deletedElsewhere = !!rowGUID && everSeen.current && !row && loaded;
  const notFound = !!rowGUID && !everSeen.current && !row && loaded;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      // new stage: the code follows the name until the user edits the code
      if (k === 'stageName' && !codeTouched) next.stageCode = kanbanStageCodeOf(String(v));
      return next;
    });
    if (k === 'stageCode') setCodeTouched(true);
    setDirty(true);
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const back = () => router.replace(KANBAN_STAGE_ROUTES.list as any);

  const save = () => {
    const value = normalizeKanbanStage(form);
    const e = validateKanbanStage(value, rows, rowGUID);
    setErrors(e);
    if (Object.keys(e).length || !actions) return;
    if (rowGUID) {
      dispatch(actions.updateOne({ rowGUID, rowOwnerGUID: row?.rowOwnerGUID ?? KANBAN_STAGE_CATALOG_OWNER, rowJSON: value }));
    } else {
      const last = rows.reduce((m, r) => Math.max(m, Number(r.orderInList) || 0), 0);
      dispatch(
        actions.createOne({
          rowGUID: Crypto.randomUUID(),
          rowOwnerGUID: KANBAN_STAGE_CATALOG_OWNER,
          rowParentGUID: 'empty',
          orderInList: last + PM_KANBAN_ORDER_STEP, // new stages go last
          rowJSON: value,
        })
      );
    }
    setDirty(false);
    back();
  };

  const remove = () => {
    if (!rowGUID || !actions) return;
    if (!confirmDelete) return setConfirmDelete(true);
    dispatch(actions.deleteOne({ rowGUID, rowOwnerGUID: row?.rowOwnerGUID ?? KANBAN_STAGE_CATALOG_OWNER }));
    back();
  };

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" testID="kanban-stage-edit">
      <View style={styles.titleRow}>
        <View style={[styles.swatchBig, { backgroundColor: /^#[0-9A-F]{6}$/i.test(form.stageColor) ? form.stageColor : c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>{rowGUID ? `Kanban stage ${row?.rowJSON.stageName ?? ''}` : 'New Kanban stage'}</Text>
        <CurrencyRealtimeBadge status={status} />
      </View>

      {remoteChanged && (
        <View style={[styles.banner, { borderColor: c.primary, backgroundColor: `${c.primary}14` }]} testID="kanban-stage-edit-remote-changed">
          <Text style={{ color: c.text, flex: 1 }}>This stage was changed in another window.</Text>
          <ButtonTextApp
            testID="kanban-stage-edit-reload"
            onPress={() => {
              seenVersion.current = rowVersion(row);
              setForm(toForm(row?.rowJSON as any));
              setDirty(false);
              setRemoteChanged(false);
            }}
          >
            Reload
          </ButtonTextApp>
          <ButtonTextApp
            testID="kanban-stage-edit-keep"
            onPress={() => {
              seenVersion.current = rowVersion(row);
              setRemoteChanged(false);
            }}
          >
            Keep mine
          </ButtonTextApp>
        </View>
      )}
      {(deletedElsewhere || notFound) && (
        <View style={[styles.banner, { borderColor: c.error }]} testID="kanban-stage-edit-gone">
          <Text style={{ color: c.error }}>{deletedElsewhere ? 'This stage was deleted in another window.' : 'Kanban stage not found.'}</Text>
        </View>
      )}

      <TextInputApp
        testID="kanban-stage-edit-stageName"
        label="Name"
        value={form.stageName}
        onChangeText={(v: string) => set('stageName', v)}
        maxLength={PM_KANBAN_STAGE_NAME_MAX}
        error={errors.stageName}
        showError={!!errors.stageName}
      />
      <TextInputApp
        testID="kanban-stage-edit-stageCode"
        label="Code (a-z, 0-9, _)"
        value={form.stageCode}
        onChangeText={(v: string) => set('stageCode', v.toLowerCase())}
        autoCapitalize="none"
        maxLength={30}
        error={errors.stageCode}
        showError={!!errors.stageCode}
      />
      <TextInputApp
        testID="kanban-stage-edit-stageColor"
        label="Color (#RRGGBB)"
        value={form.stageColor}
        onChangeText={(v: string) => set('stageColor', v.toUpperCase())}
        autoCapitalize="characters"
        maxLength={7}
        error={errors.stageColor}
        showError={!!errors.stageColor}
      />
      <View style={styles.swatches} testID="kanban-stage-edit-colors">
        {PM_KANBAN_STAGE_COLORS.map((color) => {
          const active = form.stageColor.toUpperCase() === color.toUpperCase();
          return (
            <Pressable
              key={color}
              testID={`kanban-stage-edit-color-${color}`}
              accessibilityLabel={color}
              onPress={() => set('stageColor', color.toUpperCase())}
              style={[styles.swatch, { backgroundColor: color, borderColor: active ? c.text : c.border, borderWidth: active ? 2 : StyleSheet.hairlineWidth }]}
            />
          );
        })}
      </View>
      <SwitchApp testID="kanban-stage-edit-isActive" label="Active (copied into new projects)" value={form.isActive} onValueChange={(v) => set('isActive', v)} />

      <View style={styles.actions}>
        {rowGUID && !deletedElsewhere && !notFound ? (
          <ButtonTextApp testID="kanban-stage-edit-delete" onPress={remove} color={c.error}>
            {confirmDelete ? 'Press again to delete' : 'Delete'}
          </ButtonTextApp>
        ) : (
          <View />
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ButtonTextApp testID="kanban-stage-edit-cancel" onPress={back}>
            Cancel
          </ButtonTextApp>
          <ButtonPrimaryApp testID="kanban-stage-edit-save" onPress={save} disabled={deletedElsewhere || notFound}>
            {rowGUID ? 'Save' : 'Create'}
          </ButtonPrimaryApp>
        </View>
      </View>
      <Text style={[styles.hint, { color: c.text }]}>
        Existing projects keep their own stages (Project settings → Kanban Stages).{Platform.OS === 'web' ? ' Changes appear in every open browser automatically.' : ''}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '700' },
  swatchBig: { width: 22, height: 22, borderRadius: 11 },
  banner: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12, gap: 6 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  hint: { fontSize: 12, opacity: 0.6, marginTop: 12, textAlign: 'center' },
});
