// MainVendorFields - the two inputs of the main vendor in a form (partner item): the vendor and ITS contract. The contract select is empty and disabled until a vendor is chosen and is cleared when the vendor changes.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import SelectElementFromCatalog from '../inner/select_element/SelectElementFromCatalog';
import { PARTNER_CATALOG_OWNER, PARTNER_ENTITY } from '../partner/partnerModel';
import { CONTRACT_ENTITY } from '../contract/contractModel';
import { MainVendorValue, isVendorCandidate, mainVendorError } from './mainVendorModel';

export interface MainVendorFieldsProps {
  value: MainVendorValue;
  onChange: (next: { mainVendorGUID: string; mainVendorContractGUID: string }) => void;
  /** the partner being edited: it cannot be its own vendor */
  ownGUID?: string | null;
  contracts?: { rowGUID: string; rowOwnerGUID: string; rowParentGUID: string }[];
  disabled?: boolean;
  testID?: string;
}

export default function MainVendorFields({ value, onChange, ownGUID, contracts = [], disabled, testID = 'main-vendor' }: MainVendorFieldsProps) {
  const vendor = String(value.mainVendorGUID ?? '');
  const contract = String(value.mainVendorContractGUID ?? '');
  const error = mainVendorError(value, contracts, ownGUID);
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.cell}>
        <SelectElementFromCatalog
          testID={`${testID}-vendor`} entityName={PARTNER_ENTITY} rowOwnerGUID={PARTNER_CATALOG_OWNER} label="Main vendor" placeholder="Select vendor…"
          value={vendor || null} disabled={disabled}
          filterItem={(p: any) => p.rowGUID !== ownGUID && isVendorCandidate(p, vendor)}
          onChange={(guid) => onChange({ mainVendorGUID: guid ?? '', mainVendorContractGUID: '' })}
        />
      </View>
      <View style={styles.cell}>
        <SelectElementFromCatalog
          testID={`${testID}-contract`} entityName={CONTRACT_ENTITY} rowParentGUID="partner" rowOwnerGUID={vendor || undefined} label="Main vendor contract" placeholder="Select contract…"
          value={contract || null} disabled={disabled || !vendor} disabledMessage="Select a vendor first"
          onChange={(guid) => onChange({ mainVendorGUID: vendor, mainVendorContractGUID: guid ?? '' })}
        />
      </View>
      {!!error && <View testID={`${testID}-error`} />}
    </View>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, cell: { flex: 1, minWidth: 220 } });
