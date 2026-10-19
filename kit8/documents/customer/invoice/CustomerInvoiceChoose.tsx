// CustomerInvoiceChoose - "Customer Invoice" of the context menu (after "Fact input"): the VENDORS of the lines of a task (route /pm/project/task/customer-invoice/new?taskGUID=…&lineGUIDs=…).
//   one row per (customer, contract): a check box, the customer, its contract, the currency, the lines. The user checks the customers needed and presses CREATE:
//   ONE draft document is made for each checked pair (1 customer + 1 contract), then the form opens - with a tab for each document (and a browser tab of its own on the web).
//   The legal entity of the documents: the one of the contract; a contract without one asks for it here.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import IconApp from '../../../ui/components/common/IconApp';
import SelectElementFromCatalog from '../../../catalog/inner/select_element/SelectElementFromCatalog';
import { LEGAL_ENTITY_TABLE, legalEntityTitle } from '../../../catalog/legal_entity/legalEntityModel';
import { pmT } from '../../../pm/i18n/pmT';
import { NO_CUSTOMER_KEY, candidateKey, candidateSelection, needsLegalEntity } from './customerInvoiceModel';
import { useCreateCustomerInvoices, useCustomerCandidates } from './useCustomerInvoice';
import { showCreatedCustomerInvoices } from './customerInvoiceNavigation';

export interface CustomerInvoiceChooseProps {
  taskGUID: string;
  /** only these task lines (the lines the user selected / right-clicked); empty = every line of the task */
  lineGUIDs?: string[] | null;
  projectGUID?: string | null;
  onClose?: () => void;
  testID?: string;
}

const NO_LINES: string[] = [];

export default function CustomerInvoiceChoose({ taskGUID, lineGUIDs, projectGUID, onClose, testID = 'customer-choose' }: CustomerInvoiceChooseProps) {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const cand = useCustomerCandidates(taskGUID, lineGUIDs);
  const { create, busy, error } = useCreateCustomerInvoices();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [legalEntity, setLegalEntity] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  // the lines that have no customer are ONE more row: a draft without a customer (the customer is chosen in the form)
  const noCustomer = cand.skippedLineGUIDs ?? NO_LINES;
  // everything is checked when it arrives; the user unchecks the ones not needed
  const keys = [...cand.rows.map(candidateKey), ...(noCustomer.length ? [NO_CUSTOMER_KEY] : [])].join('|');
  useEffect(() => setChecked(new Set([...cand.rows.map(candidateKey), ...(noCustomer.length ? [NO_CUSTOMER_KEY] : [])])), [keys]);   // eslint-disable-line react-hooks/exhaustive-deps

  const selection = useMemo(() => candidateSelection(cand.rows, checked, noCustomer), [cand.rows, checked, noCustomer]);
  const askLegalEntity = needsLegalEntity(cand.rows, checked);
  const canCreate = selection.length > 0 && (!askLegalEntity || !!legalEntity) && !busy;
  const toggle = (key: string) => setChecked((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const doCreate = async () => {
    setNotice(null);
    const answer = await create(taskGUID, selection, legalEntity || null);
    if (!answer) return;
    const guids = answer.documents.map((d) => d.documentGUID);
    if (!guids.length) { setNotice(pmT('Nothing is left to invoice: the whole quantity is already on customer invoices.')); cand.refetch(); return; }
    showCreatedCustomerInvoices(router, { taskGUID, projectGUID }, guids, 'replace');
  };

  return (
    <View testID={testID} style={styles.root}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="receipt_long" size={20} color={c.primary} />
        <View style={{ flexShrink: 1 }}>
          <Text testID={`${testID}-title`} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Customer Invoice')}</Text>
          <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{pmT('Check the customers needed: one invoice is made for each customer and contract.')}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {onClose && <ButtonApp testID={`${testID}-close`} title={pmT('Close')} variant="text" size="small" onPress={onClose} />}
        <ButtonApp testID={`${testID}-create`} title={pmT('Create')} icon="add" size="large" disabled={!canCreate} loading={busy} onPress={doCreate} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {cand.isLoading && <Text style={{ color: c.text, opacity: 0.6 }}>{pmT('Loading…')}</Text>}
        {!!cand.error && <Text testID={`${testID}-error`} style={{ color: c.error }}>{cand.error}</Text>}
        {!!error && <Text testID={`${testID}-create-error`} style={{ color: c.error }}>{error}</Text>}
        {!!notice && <Text testID={`${testID}-notice`} style={{ color: c.text }}>{notice}</Text>}
        {!cand.isLoading && !cand.error && cand.rows.length === 0 && noCustomer.length === 0 && (
          <Text testID={`${testID}-empty`} style={{ color: c.text, opacity: 0.7 }}>
            {pmT('No customer was found for the lines of this task. A Deliverable line has a customer through its contract or its partner.')}
          </Text>
        )}

        {cand.rows.map((r) => {
          const key = candidateKey(r);
          const on = checked.has(key);
          return (
            <Pressable key={key} accessibilityRole="checkbox" aria-checked={on} testID={`${testID}-row-${key}`} onPress={() => toggle(key)} style={[styles.row, { borderColor: on ? c.primary : c.border, backgroundColor: on ? `${c.primary}10` : c.surface }]}>
              <IconApp name={on ? 'check_box' : 'check_box_outline_blank'} size={22} color={on ? c.primary : c.text} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{r.partnerTitle}</Text>
                <Text numberOfLines={1} style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{r.contractInfo ?? pmT('no contract')}{r.contractCurrency ? ` · ${r.contractCurrency}` : ''}</Text>
              </View>
              <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{r.lineCount} {pmT('lines')}</Text>
            </Pressable>
          );
        })}

        {/* the project switched "empty customers" off (Project settings → Customer): those lines are left out */}
        {cand.skipped > 0 && noCustomer.length === 0 && (
          <Text testID={`${testID}-skipped`} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{cand.skipped} {pmT('lines have no customer and are left out (Project settings → Customer: create customer invoices from tasks with empty customers).')}</Text>
        )}

        {/* the lines without a customer (no contract, no partner): ONE draft without a customer - the customer is chosen in the invoice before Post */}
        {noCustomer.length > 0 && (() => {
          const on = checked.has(NO_CUSTOMER_KEY);
          return (
            <Pressable key={NO_CUSTOMER_KEY} accessibilityRole="checkbox" aria-checked={on} testID={`${testID}-row-${NO_CUSTOMER_KEY}`} onPress={() => toggle(NO_CUSTOMER_KEY)} style={[styles.row, { borderColor: on ? c.primary : c.border, backgroundColor: on ? `${c.primary}10` : c.surface }]}>
              <IconApp name={on ? 'check_box' : 'check_box_outline_blank'} size={22} color={on ? c.primary : c.text} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{pmT('No customer')}</Text>
                <Text numberOfLines={2} style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('These lines have no customer: choose it in the invoice before Post.')}</Text>
              </View>
              <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{noCustomer.length} {pmT('lines')}</Text>
            </Pressable>
          );
        })()}

        {askLegalEntity && (
          <View style={{ maxWidth: 420 }}>
            <SelectElementFromCatalog
              testID={`${testID}-legalEntity`} entityName={LEGAL_ENTITY_TABLE.entity} label={pmT('Legal entity (a checked contract has none)')} placeholder={pmT('Select legal entity…')}
              value={legalEntity || null} titleExtractor={legalEntityTitle} onChange={(guid) => setLegalEntity(guid ?? '')}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10 },
});
