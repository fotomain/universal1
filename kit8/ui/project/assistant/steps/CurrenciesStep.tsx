// Step 3 - the currencies of THE PROJECT (each project owns its currencies; a new project starts from the organization's) + the consolidation currency of the
// organization, read only (the one currency in which the money of ALL projects is added: Organization edit -> Consolidation).
import React from 'react';
import { View } from 'react-native';
import { CurrencyField } from '../components/AssistantFields';
import type { AssistantStepProps } from './stepProps';

export default function CurrenciesStep({ values, ctx, onChange }: AssistantStepProps) {
  return (
    <View>
      <CurrencyField id="budget" label="Budget currency" value={values.currencyForBudget} onChange={(currencyForBudget) => onChange({ currencyForBudget })} editable helper="The currency management reads the project in." />
      <CurrencyField id="accounting" label="Accounting currency" value={values.currencyForAccounting} onChange={(currencyForAccounting) => onChange({ currencyForAccounting })} editable helper="The currency of the legal books." />
      <CurrencyField id="contract" label="Default currency for contracts" value={values.currencyForContract} onChange={(currencyForContract) => onChange({ currencyForContract })} editable helper="Empty = the budget currency." />
      <CurrencyField id="consolidation" label="Consolidation currency (organization)" value={ctx.consolidationCurrency} onChange={() => undefined} editable={false} helper="The money of all projects is added in this currency. Set in Organization edit, tab Consolidation." />
    </View>
  );
}
