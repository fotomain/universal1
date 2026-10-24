// PMPaymentFactDocumentHeader - the HEADER of a payment fact (ONE bank transaction): document number · date · number of the bank transaction · money account · direction · payee (a partner OR a person) · currency of
// the account (read only) · the control amount of the bank (optional) · the totals of the lines. Every field is a TextInputApp (the selects too: asInput) without its outer margin, so the boxes of the row have the same
// height and are centered on one line. A DRAFT saves the money account, the direction and the payee AT ONCE (doc.setHeader); the number, the date and the bank amount are typed in the form and saved a moment after
// the last key. The payee and the direction are fixed while the document has lines (delete the lines first).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import DateInputApp from '../../../ui/components/common/date_input/DateInputApp';
import SelectItemFromListApp from '../../../ui/components/common/SelectItemFromListApp';
import SelectElementFromCatalog from '../../../catalog/inner/select_element/SelectElementFromCatalog';
import { PARTNER_CATALOG_OWNER, PARTNER_ENTITY } from '../../../catalog/partner/partnerModel';
import { PERSON_CATALOG_OWNER, PERSON_ENTITY } from '../../../catalog/person/personModel';
import { MONEY_ACCOUNT_CATALOG_OWNER, MONEY_ACCOUNT_ENTITY, moneyAccountLabel } from '../../../catalog/money_account/moneyAccountModel';
import { personFullName } from '../../../pm/view/task/finances/taskLineResource';
import { pmT } from '../../../pm/i18n/pmT';
import { PAYMENT_FACT_BALANCE_ROLES, PAYMENT_FACT_DIRECTIONS, PaymentFactBalanceRole, PaymentFactHeaderView, PaymentFactLineTotals, bankAmountDifference, canChangePayee, formatMoney } from './paymentFactModel';
import type { UsePaymentFactDocuments } from './usePaymentFact';

export interface PMPaymentFactDocumentHeaderProps {
  header: PaymentFactHeaderView;
  /** the document is a draft: its fields can be changed */
  edit: boolean;
  lineCount: number;
  /** the number, the date and the bank amount as typed (saved by the form a moment after the last key) */
  number: string;
  day: string;
  dayError: boolean;
  bankAmount: string;
  onNumber: (text: string) => void;
  onDay: (text: string) => void;
  onBankAmount: (text: string) => void;
  totals: PaymentFactLineTotals;
  setHeader: UsePaymentFactDocuments['setHeader'];
  testID?: string;
}

export default function PMPaymentFactDocumentHeader({ header, edit, lineCount, number, day, dayError, bankAmount, onNumber, onDay, onBankAmount, totals, setHeader, testID = 'payment-fact' }: PMPaymentFactDocumentHeaderProps) {
  const { themeColors: c } = useDesignSystem();
  const payeeFixed = !canChangePayee(header, lineCount);
  const typedBank = bankAmount.trim() === '' ? null : Number(bankAmount.replace(',', '.'));
  const diff = bankAmountDifference(typedBank !== null && Number.isFinite(typedBank) ? typedBank : header.bankAmount, totals);
  return (
    <View testID={`${testID}-form`} style={styles.form}>
      <View style={{ width: 130 }}>
        <TextInputApp testID={`${testID}-field-number`} label={pmT('Document')} value={header.number} compact disabled hideClearIcon style={FIELD} />
      </View>
      <View style={{ width: 200 }}>
        <DateInputApp testID={`${testID}-field-date`} label={pmT('Date of the bank transaction')} value={day} compact disabled={!edit} error={dayError} style={FIELD} onChangeText={onDay} />
      </View>
      <View style={{ width: 190 }}>
        <TextInputApp testID={`${testID}-field-bankNumber`} label={pmT('Bank transaction no.')} value={number} compact disabled={!edit} style={FIELD} onChangeText={onNumber} />
      </View>
      <View style={{ width: 240 }}>
        {edit ? (
          <SelectElementFromCatalog
            testID={`${testID}-field-account`} entityName={MONEY_ACCOUNT_ENTITY} rowOwnerGUID={MONEY_ACCOUNT_CATALOG_OWNER} label={pmT('Money account')} placeholder={pmT('Select money account…')} compact asInput
            value={header.moneyAccountGUID || null} titleExtractor={moneyAccountLabel} filterItem={(r) => r?.rowJSON?.isActive !== false || r?.rowGUID === header.moneyAccountGUID}
            onChange={(guid) => { void setHeader(header.guid, { moneyAccountFact: guid ?? '' }); }}
          />
        ) : (
          <TextInputApp testID={`${testID}-field-account`} label={pmT('Money account')} value={header.moneyAccountTitle} compact disabled hideClearIcon style={FIELD} />
        )}
      </View>
      <View style={{ width: 90 }}>
        <TextInputApp testID={`${testID}-field-currency`} label={pmT('Currency')} value={header.currency} compact disabled hideClearIcon style={FIELD} />
      </View>
      <View style={{ width: 150 }}>
        <SelectItemFromListApp
          testID={`${testID}-field-direction`} items={PAYMENT_FACT_DIRECTIONS.map((d) => ({ value: d.value, label: pmT(d.label), icon: d.icon }))} value={header.direction || null}
          onSelect={(v) => { void setHeader(header.guid, { paymentFactDirection: v }); }} placeholder={pmT('Direction')} searchPlaceholder={pmT('Direction')} disabled={payeeFixed} fieldHeight={42} fieldRadius={4}
        />
      </View>
      {payeeFixed ? (
        <View style={{ width: 240 }}>
          <TextInputApp testID={`${testID}-field-payee`} label={pmT('Payee')} value={header.payeeTitle} compact disabled hideClearIcon style={FIELD} />
        </View>
      ) : (
        <>
          <View style={{ width: 220 }}>
            <SelectElementFromCatalog
              testID={`${testID}-field-partner`} entityName={PARTNER_ENTITY} rowOwnerGUID={PARTNER_CATALOG_OWNER} label={header.direction === 'inbound' ? pmT('Customer') : pmT('Supplier')} placeholder={pmT('Select partner…')} compact asInput
              value={header.partnerGUID || null} onChange={(guid) => { void setHeader(header.guid, { paymentFactPartner: guid ?? '' }); }}
            />
          </View>
          {header.direction !== 'inbound' && (
            <View style={{ width: 210 }}>
              <SelectElementFromCatalog
                testID={`${testID}-field-person`} entityName={PERSON_ENTITY} rowOwnerGUID={PERSON_CATALOG_OWNER} label={pmT('Person')} placeholder={pmT('Select person…')} compact asInput titleExtractor={personFullName}
                value={header.personGUID || null} onChange={(guid) => { void setHeader(header.guid, { paymentFactPerson: guid ?? '' }); }}
              />
            </View>
          )}
        </>
      )}
      <View style={{ width: 170 }}>
        <SelectItemFromListApp
          testID={`${testID}-field-balanceRole`} items={PAYMENT_FACT_BALANCE_ROLES.map((r) => ({ value: r.value || 'direction', label: pmT(r.label) }))} value={header.balanceRole || 'direction'} disabled={!edit}
          onSelect={(v) => { void setHeader(header.guid, { paymentFactBalanceRole: (v === 'direction' ? '' : v) as PaymentFactBalanceRole | '' }); }} placeholder={pmT('Settles in the balance of')} searchPlaceholder={pmT('Settles in the balance of')} fieldHeight={42} fieldRadius={4}
        />
      </View>
      <View style={{ width: 170 }}>
        <TextInputApp testID={`${testID}-field-bankAmount`} label={pmT('Bank amount (check)')} value={bankAmount} compact disabled={!edit} style={FIELD} keyboardType="numeric" onChangeText={onBankAmount} />
      </View>
      <View testID={`${testID}-totals`} style={styles.totals}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>{pmT('Document total')} · {totals.lineCount} {pmT('lines')}{header.currency ? ` · ${header.currency}` : ''}</Text>
        <Text testID={`${testID}-total-account`} style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>{pmT('Amount of the money account')} {formatMoney(totals.sumForMoneyAccount)}</Text>
        {totals.byCurrency.map((t) => (
          <Text key={t.currency || 'none'} testID={`${testID}-total-contract-${t.currency || 'none'}`} style={{ color: c.text, fontSize: 12 }}>{pmT('Contracts')} {t.currency}: {formatMoney(t.sumForContract)}</Text>
        ))}
        {totals.withoutAccountSum > 0 && <Text testID={`${testID}-total-missing`} style={{ color: c.error, fontSize: 12 }}>{totals.withoutAccountSum} {pmT('lines have no amount of the money account')}</Text>}
        {diff !== null && (
          <Text testID={`${testID}-total-diff`} style={{ color: diff === 0 ? c.text : c.error, fontSize: 12 }}>
            {diff === 0 ? pmT('The lines equal the bank amount.') : `${pmT('Bank amount minus the lines')}: ${formatMoney(diff)}`}
          </Text>
        )}
      </View>
    </View>
  );
}

/** no outer margin: the boxes of the form row are centered on one line */
const FIELD = { marginBottom: 0 };

const styles = StyleSheet.create({
  form: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  totals: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingBottom: 8, marginLeft: 8 },
});
