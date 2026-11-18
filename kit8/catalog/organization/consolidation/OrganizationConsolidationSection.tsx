// OrganizationConsolidationSection - the block "Consolidation" of Organization edit (documentation/CONSOLIDATION_WBS.html section 2): the OBLIGATORY currency in which the money of all
// projects is added (a select without Clear), the rate type, the two VAT switches (each with a sentence), the state badge, the number of gaps and "Refresh now".
// The values live in the form of the screen (saved with its Save button); the state comes from the database (useConsolidationStatus). Only the administrator edits (disabled = true for the others).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ButtonTextApp from '../../../ui/components/common/ButtonTextApp';
import SwitchApp from '../../../ui/components/common/SwitchApp';
import SegmentButtonsApp from '../../../ui/components/common/SegmentButtonsApp';
import SelectElementFromCatalog from '../../inner/select_element/SelectElementFromCatalog';
import { CURRENCY_CATALOG_OWNER, CURRENCY_ENTITY } from '../../currency/currencyModel';
import { RATE_TYPES } from '../../currency/exchange/currencyExchangeModel';
import { pmT } from '../../../pm/i18n/pmT';
import {
  CONSOLIDATION_CURRENCY_REQUIRED,
  CONSOLIDATION_STATE_TEXT,
  PURCHASE_VAT_TEXT,
  SALE_VAT_TEXT,
  type ConsolidationSettings,
} from './consolidationModel';
import { useConsolidationStatus } from './useConsolidationStatus';

export default function OrganizationConsolidationSection({
  value,
  onChange,
  disabled,
  error,
  statusEnabled = true,
}: {
  value: ConsolidationSettings;
  onChange: (patch: Partial<ConsolidationSettings>) => void;
  /** the user is not the administrator of the organization */
  disabled?: boolean;
  /** the message under the currency (a save without it) */
  error?: string;
  /** read the status of the database (false for a NEW organization: it has none yet) */
  statusEnabled?: boolean;
}) {
  const { themeColors: c } = useDesignSystem();
  const currencies: any[] = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.entityDataFromServer) || [];
  const { status, error: statusError, busy, refreshNow } = useConsolidationStatus(statusEnabled);
  const code = value.currency.toUpperCase();
  const row = code ? currencies.find((r) => String(r?.rowJSON?.currencyCode || '').toUpperCase() === code) : undefined;
  const stateColor = status?.state === 'ready' ? '#16a34a' : status?.state === 'gaps' ? '#c2410c' : c.primary;

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID="organization-consolidation-tab-content">
      <Text style={[styles.title, { color: c.text }]}>{pmT('Consolidation')}</Text>
      <Text style={[styles.note, { color: c.text }]}>
        {pmT('The money of ALL projects of the organization is added in ONE currency. Every project keeps its own currencies; the database converts each movement into this currency (sumForConsolidation) and the reports show it. It appears in the reports only, never in a document.')}
      </Text>

      <SelectElementFromCatalog
        testID="organization-consolidation-currency"
        label={pmT('Currency for consolidation (obligatory)')}
        entityName={CURRENCY_ENTITY}
        rowOwnerGUID={CURRENCY_CATALOG_OWNER}
        scopeFetchByOwner={false}
        value={row?.rowGUID ?? null}
        placeholder={code || pmT('Select currency...')}
        disabled={disabled}
        filterItem={(r: any) => r?.rowJSON?.isActive !== false || r?.rowGUID === row?.rowGUID}
        titleExtractor={(r: any) => [r?.rowJSON?.currencyCode, r?.rowJSON?.currencyName].filter(Boolean).join(' — ')}
        subtitleExtractor={(r: any) => r?.rowJSON?.currencySymbol || undefined}
        // no Clear: the currency is obligatory (a pick of another currency replaces it)
        onChange={(_guid, r) => {
          const next = String(r?.rowJSON?.currencyCode || '').toUpperCase();
          if (next) onChange({ currency: next });
        }}
      />
      {(!code || error) && (
        <Text testID="organization-consolidation-currency-error" style={[styles.error]}>{pmT(error || CONSOLIDATION_CURRENCY_REQUIRED)}</Text>
      )}

      <Text style={[styles.label, { color: c.text }]}>{pmT('Exchange rate type')}</Text>
      <SegmentButtonsApp
        testID="organization-consolidation-rateType"
        value={value.rateType}
        onValueChange={(v: string) => { if (!disabled) onChange({ rateType: v }); }}
        buttons={RATE_TYPES.map((t) => ({ value: t.value, label: t.label, testID: `organization-consolidation-rateType-${t.value}` }))}
      />

      <SwitchApp
        testID="organization-consolidation-purchaseVat"
        label={pmT('Include purchase VAT into consolidation')}
        value={value.includePurchaseVAT}
        onValueChange={(v) => onChange({ includePurchaseVAT: v })}
        disabled={disabled}
      />
      <Text style={[styles.note, { color: c.text }]}>{pmT(PURCHASE_VAT_TEXT)}</Text>
      <SwitchApp
        testID="organization-consolidation-saleVat"
        label={pmT('Include sale VAT into consolidation')}
        value={value.includeSaleVAT}
        onValueChange={(v) => onChange({ includeSaleVAT: v })}
        disabled={disabled}
      />
      <Text style={[styles.note, { color: c.text }]}>{pmT(SALE_VAT_TEXT)}</Text>

      {statusEnabled && (
        <View style={styles.statusRow} testID="organization-consolidation-status">
          <View style={[styles.dot, { backgroundColor: stateColor }]} />
          <Text testID="organization-consolidation-state" style={{ color: c.text, fontWeight: '700' }}>
            {status ? pmT(CONSOLIDATION_STATE_TEXT[status.state]) : pmT('Status is not available')}
          </Text>
          {!!status && status.gaps > 0 && (
            <Text testID="organization-consolidation-gaps" style={{ color: c.text, opacity: 0.75 }}>{pmT('{{n}} movement(s) without a rate', { n: status.gaps })}</Text>
          )}
          {!!status && status.queued > 0 && (
            <Text testID="organization-consolidation-queued" style={{ color: c.text, opacity: 0.75 }}>{pmT('{{n}} project(s) queued', { n: status.queued })}</Text>
          )}
          <ButtonTextApp testID="organization-consolidation-refresh" title={busy ? pmT('Refreshing ...') : pmT('Refresh now')} onPress={() => { if (!busy) void refreshNow(); }} />
        </View>
      )}
      {!!statusError && <Text style={styles.error}>{statusError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 12, opacity: 0.7, marginTop: 4 },
  note: { fontSize: 12, opacity: 0.7 },
  error: { color: '#dc2626', fontSize: 12 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
