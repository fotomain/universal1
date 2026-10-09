// TemplateResourceContractCRUD - the templates of the resource contract (templateResourceContractTable): the contract a task line asks for
// before a partner is known, one list per management genus (rowOwnerGUID = managementGenus.rowGUID).
//   [ All | Time | Material | Expenses | Revenues ... ]  chips = the leaf genus (managementGenusTable items), with their counts
//   ReusableTable (all-rows mode)   add / duplicate / reorder / sql_for_delete + Undo, in-place editing, search, column sort + filter, export, realtime;
//                                   a new row gets the genus of the chip (on "All": the first genus)
// A task line (Material / Expense / Revenue) picks one of the templates of ITS genus: task_line_table.rowJSON.resourceContractTemplateTaskLine.
// Route: /catalog/management/templateresourcecontract/list (?focusRowGUID=<template> marks the row, used by the "…" of the task line)
// SQL: kit8/sql/init/create_template_resource_contract_table.sql
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { shallowEqual, useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { usePMStore } from '../../../pm/store/store_pm';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { managementGenusItems } from '../genus/managementGenusModel';
import { useManagementGenusData } from '../genus/useManagementGenusData';
import {
  CONTRACT_TYPE_OPTIONS, emptyTemplateResourceContract, PAYMENT_PERIOD_OPTIONS, TEMPLATE_RESOURCE_CONTRACT_ENTITY, TEMPLATE_RESOURCE_CONTRACT_TABLE,
} from './templateResourceContractModel';

export interface TemplateResourceContractCRUDProps {
  /** only the templates of this genus (no chips); omitted = all genus with chips */
  genus?: string | null;
  testID?: string;
}

const ALL = '*';

export default function TemplateResourceContractCRUD({ genus: fixedGenus = null, testID = 'tpl-contract' }: TemplateResourceContractCRUDProps) {
  const { themeColors: c } = useDesignSystem();
  const selectRowCheckBoxForm = usePMStore((s: any) => s.selectRowCheckBoxForm);
  const { rows: genusRows, loaded: genusLoaded, error: genusError } = useManagementGenusData(true);
  const leafGenus = useMemo(() => managementGenusItems(genusRows).slice().sort((a, b) => Number(a.orderInList) - Number(b.orderInList)), [genusRows]);
  const templates: ReusableTableRow[] = useSelector((s: any) => s?.[TEMPLATE_RESOURCE_CONTRACT_ENTITY]?.entityDataFromServer, shallowEqual) ?? [];
  const [picked, setPicked] = useState<string>(ALL);
  const genus = fixedGenus ?? picked;

  const genusOptions = useMemo(() => leafGenus.map((g) => ({ value: g.rowGUID, label: String(g.rowJSON?.title ?? '').trim() || g.rowGUID })), [leafGenus]);
  const perGenus = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of Array.isArray(templates) ? templates : []) m.set(t.rowOwnerGUID ?? '', (m.get(t.rowOwnerGUID ?? '') ?? 0) + 1);
    return m;
  }, [templates]);

  const rowFilter = useMemo(() => (genus === ALL ? undefined : (row: ReusableTableRow) => row.rowOwnerGUID === genus), [genus]);
  // a new template belongs to a genus (rowOwnerGUID cannot be empty): the chip's, else the first one
  const newRowDefaults = useMemo(() => () => ({ rowOwnerGUID: genus !== ALL ? genus : genusOptions[0]?.value ?? 'timeGenus', rowParentGUID: 'empty', rowJSON: {} }), [genus, genusOptions]);

  const columns = useMemo<VisualColumn[]>(() => [
    { key: 'n', title: '#', type: 'rowNumber' },
    { key: 'genus', title: 'Management genus', type: 'select', target: 'rowOwnerGUID', options: genusOptions, allowEmpty: false, width: 160, placeholder: 'Choose genus…' },
    { key: 'title', title: 'Title', type: 'text', width: 230, placeholder: 'Template title' },
    { key: 'contractType', title: 'Contract type', type: 'select', options: CONTRACT_TYPE_OPTIONS, width: 130 },
    { key: 'paymentsPeriod', title: 'Payments', type: 'select', options: PAYMENT_PERIOD_OPTIONS, width: 120 },
    { key: 'paymentTermDays', title: 'Payment term, days', type: 'integer', width: 150, min: 0, max: 3650, total: false },
    { key: 'currency', title: 'Currency', type: 'text', width: 90, validate: (v) => (v && !/^[A-Z]{3}$/.test(String(v)) ? 'Currency: 3 capital letters (ISO 4217), e.g. EUR' : null) },
    { key: 'vatRate', title: 'VAT %', type: 'number', width: 100, min: 0, max: 100, total: false },
    { key: 'validityDays', title: 'Valid, days', type: 'integer', width: 110, min: 0, max: 36500, total: false },
    { key: 'deliveryTerms', title: 'Delivery terms', type: 'text', width: 280 },
    { key: 'requirements', title: 'Requirements', type: 'text', width: 380 },
    { key: 'description', title: 'Description', type: 'text', width: 280 },
    { key: 'isActive', title: 'Active', type: 'boolean', width: 70 },
  ], [genusOptions]);

  const chip = (value: string, label: string, n: number) => {
    const active = genus === value;
    return (
      <Pressable key={value} testID={`${testID}-chip-${value}`} accessibilityRole="tab" aria-selected={active} onPress={() => setPicked(value)}
        style={[styles.chip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? `${c.primary}1c` : c.surface }]}>
        <Text style={{ color: active ? c.primary : c.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>{label}</Text>
        <Text style={{ color: c.text, opacity: 0.55, fontSize: 12 }}>{n}</Text>
      </Pressable>
    );
  };

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="description" size={24} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h1, { color: c.text }]}>Resource contract templates</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{TEMPLATE_RESOURCE_CONTRACT_TABLE.purpose}</Text>
        </View>
      </View>
      {(genusError || (genusLoaded && leafGenus.length === 0)) && (
        <View testID={`${testID}-setup`} style={[styles.setup, { borderColor: c.error + '66', backgroundColor: c.error + '0f' }]}>
          <IconApp name="database" size={18} color={c.error} />
          <Text style={{ color: c.text, flex: 1 }}>
            The management genus could not be read. Run kit8/sql/init/create_management_genus_table.sql and kit8/sql/init/create_template_resource_contract_table.sql in the Supabase SQL editor and sign in.
          </Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {fixedGenus === null && (
          <View style={styles.chips} testID={`${testID}-chips`}>
            {chip(ALL, 'All', Array.isArray(templates) ? templates.length : 0)}
            {genusOptions.map((g) => chip(g.value, g.label, perGenus.get(g.value) ?? 0))}
          </View>
        )}
        <ReusableTable
          key={genus}
          testID={`${testID}-table`}
          entityName={TEMPLATE_RESOURCE_CONTRACT_ENTITY}
          crudListTitle="Templates"
          itemLabel="Template"
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          visualColumns={columns}
          defaultRowJSON={emptyTemplateResourceContract}
          rowFilter={rowFilter}
          newRowDefaults={newRowDefaults}
          selectRowCheckBoxForm={selectRowCheckBoxForm}
          dragAndDropColumns
          resizeColumnWidth
          realtime
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch' }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  h1: { fontSize: 20, fontWeight: '800' },
  setup: { flexDirection: 'row', gap: 10, alignItems: 'center', margin: 10, marginBottom: 0, padding: 12, borderWidth: 1, borderRadius: 10 },
  content: { padding: 12, gap: 10, paddingBottom: 40 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
});
