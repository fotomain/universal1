// PMPurchaseOrderDocumentHeader - the HEADER of a purchase order in the form: document number · project (the chevron at its left chooses Single Project | Multi Project) · legal entity · vendor · contract ·
// currency (read only) · the number of the purchase order · its date · the totals of the lines. Every field is a TextInputApp (the selects too: asInput) without its outer margin, so the boxes of the row have the same height
// and are centered on one line. An UNPOSTED document saves the legal entity, the vendor and the contract AT ONCE (doc.setHeader); the number and the date are typed in the form and saved a moment after the last key.
// The twin of the header of VendorInvoiceDocumentForm (kit8/documents/vendor/invoice).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import DateInputApp from '../../../ui/components/common/date_input/DateInputApp';
import SelectElementFromCatalog from '../../../catalog/inner/select_element/SelectElementFromCatalog';
import { LEGAL_ENTITY_TABLE, legalEntityTitle } from '../../../catalog/legal_entity/legalEntityModel';
import { PARTNER_CATALOG_OWNER, PARTNER_ENTITY } from '../../../catalog/partner/partnerModel';
import { CONTRACT_ENTITY } from '../../../catalog/contract/contractModel';
import { pmT } from '../../../pm/i18n/pmT';
import { PurchaseOrderHeaderView, PurchaseOrderLineTotals, canChooseProjectMode, formatMoney } from './purchaseOrderModel';
import type { UsePurchaseOrderDocuments } from './usePurchaseOrder';

export interface PMPurchaseOrderDocumentHeaderProps {
  header: PurchaseOrderHeaderView;
  /** the document is a draft: its fields can be changed */
  edit: boolean;
  /** Multi Project mode (the label of the Project field says it) */
  multi: boolean;
  /** the number and the date as typed (saved by the form a moment after the last key) */
  number: string;
  day: string;
  dayError: boolean;
  onNumber: (text: string) => void;
  onDay: (text: string) => void;
  totals: PurchaseOrderLineTotals;
  setHeader: UsePurchaseOrderDocuments['setHeader'];
  /** the chevron next to the Project field */
  onOpenModeMenu: () => void;
  testID?: string;
}

export default function PMPurchaseOrderDocumentHeader({ header, edit, multi, number, day, dayError, onNumber, onDay, totals, setHeader, onOpenModeMenu, testID = 'purchase-order' }: PMPurchaseOrderDocumentHeaderProps) {
  const { themeColors: c } = useDesignSystem();
  const doc = { setHeader };
  return (
      <View testID={`${testID}-form`} style={styles.form}>
        {/* every field is a TextInputApp (the selects too: asInput) without its outer margin, so the boxes of the row have the same height and are centered on one line */}
        <View style={{ width: 130 }}>
          <TextInputApp testID={`${testID}-field-number`} label={pmT('Document')} value={header.number} compact disabled hideClearIcon style={FIELD} />
        </View>
        <View style={styles.projectField}>
          {/* Single Project | Multi Project (project setting multiProjectVendorInvoceNeeded): the chevron at the left of the Project field */}
          {canChooseProjectMode(header) && (
            <Pressable testID={`${testID}-project-mode`} accessibilityRole="button" accessibilityLabel={pmT('Single Project | Multi Project')} onPress={onOpenModeMenu} hitSlop={6} style={styles.chevron}>
              <IconApp name="expand_more" size={22} color={c.primary} />
            </Pressable>
          )}
          <View style={{ width: 200 }}>
            {/* the project of the document (purchaseOrderProject): its setting independentInvoiceInputAvailable decides whether lines can be added */}
            <TextInputApp testID={`${testID}-field-project`} label={multi ? pmT('Project · Multi Project') : pmT('Project')} value={header.projectName || ''} compact disabled hideClearIcon style={FIELD} />
          </View>
        </View>
        <View style={{ width: 230 }}>
          {edit ? (
            <SelectElementFromCatalog
              testID={`${testID}-field-legalEntity`} entityName={LEGAL_ENTITY_TABLE.entity} label={pmT('Legal entity')} placeholder={pmT('Select legal entity…')} compact asInput
              value={header.legalEntityGUID || null} titleExtractor={legalEntityTitle}
              onChange={(guid) => { if (guid) void doc.setHeader(header.guid, { legalEntityGUID: guid }); }}
            />
          ) : (
            <TextInputApp testID={`${testID}-field-legalEntity`} label={pmT('Legal entity')} value={header.legalEntityTitle} compact disabled hideClearIcon style={FIELD} />
          )}
        </View>
        {edit ? (
          // an unposted document: the vendor and its contract are chosen / changed here and saved AT ONCE (until Post; a new vendor drops the contract of the old one)
          <>
            <View style={{ width: 210 }}>
              <SelectElementFromCatalog
                testID={`${testID}-field-vendor`} entityName={PARTNER_ENTITY} rowOwnerGUID={PARTNER_CATALOG_OWNER} label={pmT('Vendor')} placeholder={pmT('Select vendor…')} compact asInput
                value={header.partnerGUID || null} onChange={(guid) => { void doc.setHeader(header.guid, { purchaseOrderPartner: guid ?? '' }); }}
              />
            </View>
            <View style={{ width: 230 }}>
              <SelectElementFromCatalog
                testID={`${testID}-field-contract`} entityName={CONTRACT_ENTITY} rowParentGUID="partner" rowOwnerGUID={header.partnerGUID || undefined} label={pmT('Contract')} placeholder={pmT('Select contract…')} compact asInput
                value={header.contractGUID || null} disabled={!header.partnerGUID} disabledMessage={pmT('Select a vendor first')} onChange={(guid) => { void doc.setHeader(header.guid, { purchaseOrderContract: guid ?? '' }); }}
              />
            </View>
          </>
        ) : (
          <>
            <View style={{ width: 210 }}>
              <TextInputApp testID={`${testID}-field-vendor`} label={pmT('Vendor')} value={header.partnerTitle} compact disabled hideClearIcon style={FIELD} />
            </View>
            <View style={{ width: 230 }}>
              <TextInputApp testID={`${testID}-field-contract`} label={pmT('Contract')} value={header.contractInfo} compact disabled hideClearIcon style={FIELD} />
            </View>
          </>
        )}
        <View style={{ width: 90 }}>
          <TextInputApp testID={`${testID}-field-currency`} label={pmT('Currency')} value={header.currency} compact disabled hideClearIcon style={FIELD} />
        </View>
        <View style={{ width: 190 }}>
          <TextInputApp
            testID={`${testID}-field-orderNumber`} label={pmT('Order number')} value={number} compact disabled={!edit} style={FIELD}
            onChangeText={onNumber}
          />
        </View>
        <View style={{ width: 200 }}>
          <DateInputApp
            testID={`${testID}-field-orderDate`} label={pmT('Order date')} value={day} compact disabled={!edit} error={dayError} style={FIELD}
            onChangeText={onDay}
          />
        </View>
        <View testID={`${testID}-totals`} style={styles.totals}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>{pmT('Document total')} · {totals.lineCount} {pmT('lines')}{header.currency ? ` · ${header.currency}` : ''}</Text>
          <Text testID={`${testID}-total-before`} style={{ color: c.text, fontSize: 12 }}>{pmT('Sum before VAT')} {formatMoney(totals.sumBeforeVAT)}</Text>
          <Text testID={`${testID}-total-vat`} style={{ color: c.text, fontSize: 12 }}>{pmT('VAT')} {formatMoney(totals.sumVAT)}</Text>
          <Text testID={`${testID}-total-with`} style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>{pmT('Sum with VAT')} {formatMoney(totals.sumWithVAT)}</Text>
        </View>
      </View>
  );
}

/** no outer margin: the boxes of the form row are centered on one line */
const FIELD = { marginBottom: 0 };

const styles = StyleSheet.create({
  projectField: { flexDirection: 'row', alignItems: 'center' },
  chevron: { paddingRight: 2 },
  form: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  totals: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingBottom: 8, marginLeft: 8 },
});
