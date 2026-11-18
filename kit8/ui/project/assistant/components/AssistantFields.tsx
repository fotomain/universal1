// The small input pieces of the assistant steps (React Native Paper): a switch row with an explanation, a date field with quick buttons, a currency field = a pick from the currency catalog.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, List, Switch, TextInput } from 'react-native-paper';
import { useSelector } from 'react-redux';
import SelectElementFromCatalog from '../../../../catalog/inner/select_element/SelectElementFromCatalog';
import { CURRENCY_CATALOG_OWNER, CURRENCY_ENTITY } from '../../../../catalog/currency/currencyModel';
import { pmT } from '../../../../pm/i18n/pmT';
import { addDaysISO, addMonthsISO, isISODate, normalizeCurrency } from '../model/assistantModel';

export function ToggleRow({ id, title, description, value, onChange, disabled }: { id: string; title: string; description?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <List.Item
      testID={`assistant-toggle-${id}`}
      title={pmT(title)}
      description={description ? pmT(description) : undefined}
      descriptionNumberOfLines={3}
      disabled={disabled}
      onPress={() => { if (!disabled) onChange(!value); }}
      right={() => <Switch value={value} disabled={disabled} onValueChange={onChange} testID={`assistant-switch-${id}`} />}
    />
  );
}

export function DateField({ id, label, value, onChange, helper, today, presets }: { id: string; label: string; value: string; onChange: (v: string) => void; helper?: string; today: string; presets?: 'start' | 'finish'; }) {
  const invalid = !!value && !isISODate(value);
  const base = isISODate(value) ? value : today;
  return (
    <View style={styles.field}>
      <TextInput
        mode="outlined"
        label={pmT(label)}
        value={value}
        onChangeText={(t) => onChange(t.trim())}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        error={invalid}
        testID={`assistant-date-${id}`}
      />
      <HelperText type={invalid ? 'error' : 'info'} visible={invalid || !!helper}>
        {invalid ? pmT('Use the form YYYY-MM-DD.') : helper ? pmT(helper) : ''}
      </HelperText>
      {presets && (
        <View style={styles.row}>
          {presets === 'start' ? (
            <>
              <Button compact mode="text" onPress={() => onChange(today)} testID={`assistant-date-${id}-today`}>{pmT('Today')}</Button>
              <Button compact mode="text" onPress={() => onChange(addDaysISO(today, 7))} testID={`assistant-date-${id}-week`}>{pmT('In a week')}</Button>
              <Button compact mode="text" onPress={() => onChange(addMonthsISO(today, 1))} testID={`assistant-date-${id}-month`}>{pmT('In a month')}</Button>
            </>
          ) : (
            <>
              <Button compact mode="text" onPress={() => onChange(addMonthsISO(base, 1))} testID={`assistant-date-${id}-plus1`}>{pmT('+1 month')}</Button>
              <Button compact mode="text" onPress={() => onChange(addMonthsISO(base, 3))} testID={`assistant-date-${id}-plus3`}>{pmT('+3 months')}</Button>
              <Button compact mode="text" onPress={() => onChange(addMonthsISO(base, 12))} testID={`assistant-date-${id}-plus12`}>{pmT('+1 year')}</Button>
              <Button compact mode="text" onPress={() => onChange('')} testID={`assistant-date-${id}-open`}>{pmT('Open end')}</Button>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// A currency is PICKED from the currency catalog (the same picker as the Project settings window), never typed. A read only one (the consolidation currency of the
// organization) is a locked text field.
const codeOf = (r: any) => String(r?.rowJSON?.currencyCode || '').toUpperCase();

export function CurrencyField({ id, label, value, onChange, editable, helper }: { id: string; label: string; value: string; onChange: (v: string) => void; editable: boolean; helper?: string }) {
  const currencies: any[] = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.entityDataFromServer) || [];
  const code = normalizeCurrency(value);
  const row = code ? currencies.find((r) => codeOf(r) === code) : undefined;
  return (
    <View style={styles.field}>
      {editable ? (
        <SelectElementFromCatalog
          testID={`assistant-currency-${id}`}
          label={pmT(label)}
          entityName={CURRENCY_ENTITY}
          rowOwnerGUID={CURRENCY_CATALOG_OWNER}
          scopeFetchByOwner={false}
          value={row?.rowGUID ?? null}
          // a code that is not in the catalog (yet) stays visible until another currency is picked
          placeholder={code || pmT('Select currency...')}
          // inactive currencies are not offered (the one already chosen stays)
          filterItem={(r: any) => r?.rowJSON?.isActive !== false || r?.rowGUID === row?.rowGUID}
          titleExtractor={(r: any) => [r?.rowJSON?.currencyCode, r?.rowJSON?.currencyName].filter(Boolean).join(' — ')}
          subtitleExtractor={(r: any) => r?.rowJSON?.currencySymbol || undefined}
          onChange={(_guid: any, r: any) => onChange(codeOf(r))}
        />
      ) : (
        <TextInput mode="outlined" label={pmT(label)} value={code} editable={false} disabled right={<TextInput.Icon icon="lock-outline" />} testID={`assistant-currency-${id}`} />
      )}
      <HelperText type="info" visible={!!helper}>
        {helper ? pmT(helper) : ''}
      </HelperText>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
