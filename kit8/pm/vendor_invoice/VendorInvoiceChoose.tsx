// VendorInvoiceChoose - "Vendor Invoice" of the context menu (after "Fact input"): the VENDORS of the lines of a task (route /pm/project/task/vendor-invoice/new?taskGUID=…&lineGUIDs=…).
//   one row per (vendor, contract): a check box, the vendor, its contract, the currency, the lines. The user checks the vendors needed and presses CREATE:
//   ONE draft document is made for each checked pair (1 vendor + 1 contract), then the form opens - with a tab for each document (and a browser tab of its own on the web).
//   The legal entity of the documents: the one of the contract; a contract without one asks for it here.
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import ButtonApp from '../../ui/components/common/ButtonApp';
import IconApp from '../../ui/components/common/IconApp';
import SelectElementFromCatalog from '../../catalog/inner/select_element/SelectElementFromCatalog';
import { LEGAL_ENTITY_TABLE, legalEntityTitle } from '../../catalog/legal_entity/legalEntityModel';
import { pmT } from '../i18n/pmT';
import { VENDOR_INVOICE_ROUTE, candidateKey, candidateSelection, needsLegalEntity, vendorInvoiceDocumentPath, vendorInvoiceRouteParams } from './vendorInvoiceModel';
import { useCreateVendorInvoices, useVendorCandidates } from './useVendorInvoice';

export interface VendorInvoiceChooseProps {
  taskGUID: string;
  /** only these task lines (the lines the user selected / right-clicked); empty = every line of the task */
  lineGUIDs?: string[] | null;
  projectGUID?: string | null;
  onClose?: () => void;
  testID?: string;
}

export default function VendorInvoiceChoose({ taskGUID, lineGUIDs, projectGUID, onClose, testID = 'vendor-choose' }: VendorInvoiceChooseProps) {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const cand = useVendorCandidates(taskGUID, lineGUIDs);
  const { create, busy, error } = useCreateVendorInvoices();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [legalEntity, setLegalEntity] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  // the vendors are all checked when they arrive; the user unchecks the ones not needed
  const keys = cand.rows.map(candidateKey).join('|');
  useEffect(() => setChecked(new Set(cand.rows.map(candidateKey))), [keys]);   // eslint-disable-line react-hooks/exhaustive-deps

  const selection = useMemo(() => candidateSelection(cand.rows, checked), [cand.rows, checked]);
  const askLegalEntity = needsLegalEntity(cand.rows, checked);
  const canCreate = selection.length > 0 && (!askLegalEntity || !!legalEntity) && !busy;
  const toggle = (key: string) => setChecked((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const doCreate = async () => {
    setNotice(null);
    const answer = await create(taskGUID, selection, legalEntity || null);
    if (!answer) return;
    const guids = answer.documents.map((d) => d.documentGUID);
    if (!guids.length) { setNotice(pmT('Nothing is left to invoice: the whole quantity is already on vendor invoices.')); cand.refetch(); return; }
    // a browser tab of its own for the other documents (best effort: a browser may block pop-ups after an async call - the form has a tab for each document anyway)
    if (Platform.OS === 'web' && guids.length > 1 && typeof window !== 'undefined') guids.slice(1).forEach((g) => { try { window.open(vendorInvoiceDocumentPath(g), '_blank'); } catch { /* the tab strip of the form is the fallback */ } });
    router.replace({ pathname: VENDOR_INVOICE_ROUTE, params: vendorInvoiceRouteParams({ taskGUID, projectGUID, documentGUID: guids[0], documents: guids }) } as any);
  };

  return (
    <View testID={testID} style={styles.root}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="receipt_long" size={20} color={c.primary} />
        <View style={{ flexShrink: 1 }}>
          <Text testID={`${testID}-title`} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Vendor Invoice')}</Text>
          <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{pmT('Check the vendors needed: one invoice is made for each vendor and contract.')}</Text>
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
        {!cand.isLoading && !cand.error && cand.rows.length === 0 && (
          <Text testID={`${testID}-empty`} style={{ color: c.text, opacity: 0.7 }}>
            {pmT('No vendor was found for the lines of this task. A line has a vendor through its contract, its partner, or the main vendor of its equipment / product (catalogs → Main vendor).')}
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

        {cand.skipped > 0 && (
          <Text testID={`${testID}-skipped`} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{cand.skipped} {pmT('lines have no vendor (no contract, no partner, no main vendor) and are not listed.')}</Text>
        )}

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
