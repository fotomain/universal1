// ContractEdit - modal dialog / form for creating or modifying a contract.
import React, { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { ButtonPrimaryApp, ButtonTextApp, TextInputApp } from '../../ui/components/common';
import SwitchApp from '../../ui/components/common/SwitchApp';
import SelectElementFromCatalog from '../inner/select_element/SelectElementFromCatalog';
import { CURRENCY_CATALOG_OWNER, CURRENCY_ENTITY } from '../currency/currencyModel';
import { SystemMetaData } from '../../redux/SystemMetaData';
import {
  CONTRACT_ENTITY,
  CONTRACT_PERIODS,
  CONTRACT_STATUSES,
  ContractErrors,
  ContractPeriodType,
  ContractRow,
  ContractRowJSON,
  ContractStatusType,
  calculateContractAmounts,
  contractOrderInList,
  emptyContract,
  normalizeContract,
  validateContract,
} from './contractModel';

export interface ContractEditProps {
  visible: boolean;
  contractRow?: ContractRow | null;
  ownerGUID: string;
  partyType: 'person' | 'partner';
  defaultCurrency?: string;
  onClose: () => void;
  onSaved?: () => void;
}

type Form = {
  contractNumber: string;
  contractTitle: string;
  contractType: string;
  contractStatus: ContractStatusType;
  contractSignedDate: string;
  contractStartDate: string;
  contractFinishDate: string;
  contractPaymentsPeriod: ContractPeriodType;
  contractCurrency: string;
  contractSumBeforeVAT: string;
  contractVATRate: string;
  notes: string;
  supplierRole: boolean;
  customerRole: boolean;
};

const toForm = (row?: ContractRow | null, partyType: 'person' | 'partner' = 'partner', defaultCurrency = 'EUR'): Form => {
  const base = emptyContract(partyType, defaultCurrency);
  const j: Partial<ContractRowJSON> = row?.rowJSON || {};
  return {

    contractNumber: j.contractNumber ?? base.contractNumber,
    contractTitle: j.contractTitle ?? base.contractTitle,
    contractType: j.contractType ?? base.contractType,
    contractStatus: j.contractStatus ?? base.contractStatus,
    contractSignedDate: j.contractSignedDate ?? base.contractSignedDate ?? '',
    contractStartDate: j.contractStartDate ?? base.contractStartDate,
    contractFinishDate: j.contractFinishDate ?? '',
    contractPaymentsPeriod: j.contractPaymentsPeriod ?? base.contractPaymentsPeriod,
    contractCurrency: j.contractCurrency ?? base.contractCurrency,
    contractSumBeforeVAT: String(j.contractSumBeforeVAT ?? 0),
    contractVATRate: String(j.contractVATRate ?? (partyType === 'person' ? 0 : 21)),
    notes: j.notes ?? '',
    supplierRole: !!j.supplierRole,
    customerRole: !!j.customerRole,
  };
};

export default function ContractEdit({
  visible,
  contractRow,
  ownerGUID,
  partyType,
  defaultCurrency = 'EUR',
  onClose,
  onSaved,
}: ContractEditProps) {
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const actions = SystemMetaData[CONTRACT_ENTITY]?.actions;

  const [form, setForm] = useState<Form>(() => toForm(contractRow, partyType, defaultCurrency));
  const [errors, setErrors] = useState<ContractErrors>({});

  useEffect(() => {
    if (visible) {
      setForm(toForm(contractRow, partyType, defaultCurrency));
      setErrors({});
    }
  }, [visible, contractRow, partyType, defaultCurrency]);

  // Currency = an element of the currency catalog; the contract keeps its ISO code (contractCurrency: "EUR")
  const currencies: any[] = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.entityDataFromServer) || [];
  const currencyCode = String(form.contractCurrency || '').toUpperCase();
  const currencyRow = currencies.find((r) => String(r?.rowJSON?.currencyCode || '').toUpperCase() === currencyCode);

  if (!visible) return null;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const isPerson = partyType === 'person';
  const numericSum = Number(form.contractSumBeforeVAT || 0);
  const numericVatRate = isPerson ? 0 : Number(form.contractVATRate || 0);
  const { contractVAT, contractTotal } = calculateContractAmounts(numericSum, numericVatRate);

  const save = () => {
    const raw: Partial<ContractRowJSON> = {
      contractPartyType: partyType,
      contractNumber: form.contractNumber,
      contractTitle: form.contractTitle,
      contractType: form.contractType,
      contractStatus: form.contractStatus,
      contractSignedDate: form.contractSignedDate || undefined,
      contractStartDate: form.contractStartDate,
      contractFinishDate: form.contractFinishDate ? form.contractFinishDate : null,
      contractPaymentsPeriod: form.contractPaymentsPeriod,
      contractCurrency: form.contractCurrency,
      contractSumBeforeVAT: numericSum,
      contractVATRate: numericVatRate,
      notes: form.notes,
      supplierRole: form.supplierRole,
      customerRole: form.customerRole,
    };

    const normalized = normalizeContract(raw);
    const errs = validateContract(normalized);
    setErrors(errs);
    if (Object.keys(errs).length || !actions || !ownerGUID) return;

    if (contractRow?.rowGUID) {
      dispatch(
        actions.updateOne({
          rowGUID: contractRow.rowGUID,
          rowOwnerGUID: ownerGUID,
          rowParentGUID: partyType,
          orderInList: contractOrderInList(normalized.contractStartDate),
          rowJSON: normalized,
        })
      );
    } else {
      dispatch(
        actions.createOne({
          rowGUID: Crypto.randomUUID(),
          rowOwnerGUID: ownerGUID,
          rowParentGUID: partyType,
          orderInList: contractOrderInList(normalized.contractStartDate),
          rowJSON: normalized,
        })
      );
    }

    onSaved?.();
    onClose();
  };

  const input = (k: keyof Form, label: string, extra: any = {}) => (
    <TextInputApp
      testID={`contract-edit-${k}`}
      label={label}
      value={String(form[k] ?? '')}
      onChangeText={(v: string) => set(k, v as any)}
      error={errors[k as keyof ContractErrors]}
      showError={!!errors[k as keyof ContractErrors]}
      {...extra}
    />
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.title, { color: c.text }]}>
            {contractRow ? `Edit Contract: ${form.contractNumber}` : 'New Contract'}
          </Text>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            <View style={styles.row}>
              <View style={{ flex: 1 }}>{input('contractNumber', 'Contract # *')}</View>
              <View style={{ flex: 1 }}>{input('contractType', 'Type (e.g. Employment, Service)')}</View>
            </View>

            {input('contractTitle', 'Title / Summary *')}

            <View style={styles.row}>
              <View style={{ flex: 1 }}>{input('contractStartDate', 'Start Date (YYYY-MM-DD) *')}</View>
              <View style={{ flex: 1 }}>{input('contractFinishDate', 'Finish Date (optional)')}</View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>{input('contractSignedDate', 'Signed Date')}</View>
              <View style={{ flex: 1 }}>
                <SelectElementFromCatalog
                  testID="contract-edit-contractCurrency"
                  label="Currency"
                  entityName={CURRENCY_ENTITY}
                  rowOwnerGUID={CURRENCY_CATALOG_OWNER}
                  scopeFetchByOwner={false}
                  value={currencyRow?.rowGUID ?? null}
                  // a code that is not in the catalog (yet) stays visible until another currency is picked
                  placeholder={currencyCode || 'Select currency…'}
                  // inactive currencies are not offered (the one already on the contract stays)
                  filterItem={(r: any) => r?.rowJSON?.isActive !== false || r?.rowGUID === currencyRow?.rowGUID}
                  titleExtractor={(r: any) => [r?.rowJSON?.currencyCode, r?.rowJSON?.currencyName].filter(Boolean).join(' — ')}
                  subtitleExtractor={(r: any) => r?.rowJSON?.currencySymbol || undefined}
                  onChange={(_guid, r) => set('contractCurrency', String(r?.rowJSON?.currencyCode || '').toUpperCase())}
                />
                {!!errors.contractCurrency && <Text style={{ color: c.error, fontSize: 12 }}>{errors.contractCurrency}</Text>}
              </View>
            </View>

            {/* Period selector */}
            <View style={styles.periodRow}>
              <Text style={[styles.fieldLabel, { color: c.text }]}>Payment Period:</Text>
              <View style={styles.periodBadges}>
                {Object.keys(CONTRACT_PERIODS).map((periodKey) => {
                  const selected = form.contractPaymentsPeriod === periodKey;
                  return (
                    <Text
                      key={periodKey}
                      onPress={() => set('contractPaymentsPeriod', periodKey as ContractPeriodType)}
                      style={[
                        styles.periodChip,
                        {
                          backgroundColor: selected ? c.primary : `${c.border}40`,
                          color: selected ? '#fff' : c.text,
                          borderColor: selected ? c.primary : c.border,
                        },
                      ]}
                    >
                      {periodKey}
                    </Text>
                  );
                })}
              </View>
            </View>

            {/* Status selector */}
            <View style={styles.periodRow}>
              <Text style={[styles.fieldLabel, { color: c.text }]}>Status:</Text>
              <View style={styles.periodBadges}>
                {Object.keys(CONTRACT_STATUSES).map((statusKey) => {
                  const selected = form.contractStatus === statusKey;
                  return (
                    <Text
                      key={statusKey}
                      onPress={() => set('contractStatus', statusKey as ContractStatusType)}
                      style={[
                        styles.periodChip,
                        {
                          backgroundColor: selected ? c.primary : `${c.border}40`,
                          color: selected ? '#fff' : c.text,
                          borderColor: selected ? c.primary : c.border,
                        },
                      ]}
                    >
                      {statusKey}
                    </Text>
                  );
                })}
              </View>
            </View>

            {/* Financials */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>{input('contractSumBeforeVAT', isPerson ? 'Salary / Period *' : 'Sum Before VAT *', { keyboardType: 'numeric' })}</View>
              {!isPerson && (
                <View style={{ flex: 1 }}>{input('contractVATRate', 'VAT Rate (%)', { keyboardType: 'numeric' })}</View>
              )}
            </View>

            {/* Calculated summary card */}
            <View style={[styles.summaryCard, { backgroundColor: `${c.primary}10`, borderColor: c.primary }]}>
              {!isPerson && (
                <View style={styles.summaryRow}>
                  <Text style={{ color: c.text, fontSize: 12 }}>VAT ({numericVatRate}%):</Text>
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>
                    {contractVAT.toFixed(2)} {form.contractCurrency}
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>Total per {form.contractPaymentsPeriod}:</Text>
                <Text style={{ color: c.primary, fontSize: 14, fontWeight: '800' }}>
                  {contractTotal.toFixed(2)} {form.contractCurrency}
                </Text>
              </View>
            </View>

            {/* Roles */}
            <View style={{ marginVertical: 8, gap: 6 }}>
              <SwitchApp
                testID="contract-edit-supplierRole"
                label="Supplier Contract (supplierRole)"
                value={form.supplierRole}
                onValueChange={(v) => set('supplierRole', v)}
              />
              <SwitchApp
                testID="contract-edit-customerRole"
                label="Customer Contract (customerRole)"
                value={form.customerRole}
                onValueChange={(v) => set('customerRole', v)}
              />
            </View>

            {input('notes', 'Notes / Terms', { multiline: true, numberOfLines: 2 })}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: c.border }]}>
            <ButtonTextApp onPress={onClose}>Cancel</ButtonTextApp>
            <ButtonPrimaryApp onPress={save}>Save Contract</ButtonPrimaryApp>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialog: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  periodRow: { marginVertical: 2 },
  periodBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  periodChip: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 4,
    marginVertical: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
});
