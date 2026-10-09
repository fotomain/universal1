// ResourceRoleEditModalCard - edits ONE resource role in a modal window (the EditRowModalCard of the Roles table); the twin of
// ProductItemEditModalCard and built from its parts (window look per design system, fields, owner tables).
//   Main        every editable column of the Roles table as a form: title, role type, folder, VAT rate, description, active
//   Cost        the hourly rates of the role (rolePriceTable): per price list, variant and day - a ReusableTable of its rows
//   Variants    the variants of the role (variantTable) - owned by its role type (variantMode perType) or by the role itself
//   Properties  the property values of the role (propertyValueTable): what the role requires (min. experience, certification)
// The three tables reuse the column definitions of the dashboard (buildResourceRoleTables), so a cell works exactly as there.
// Opened by ReusableTable: row menu "Edit" (right-click / long-press / ⋮) or a click on a row with uxuiTable.inlineEdit = false.
import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import TextApp from '../../../ui/components/common/TextApp';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import SegmentButtonsApp from '../../../ui/components/common/SegmentButtonsApp';
import type { EditRowModalCardProps } from '../../../ui/components/table/reusable/reusableTableTypes';
import { MainField, modalCardStyles as styles, OwnerRowsTable, productModalLook } from '../../product/card/ProductItemEditModalCard';
import { isSet, ResourceRoleCatalogData, rowTitle, variantOwnerOfRole, variantsOfRole } from '../crud/resourceRoleCatalogTools';
import { RESOURCE_ROLE_TABLES, ResourceRoleTableKey } from '../resourceRoleModel';
import type { ResourceRoleTableConfig } from '../dashboard/resourceRoleDashboardTables';

export type ResourceRoleTab = 'main' | 'rates' | 'variants' | 'properties';

export interface ResourceRoleEditModalCardProps extends EditRowModalCardProps {
  data: ResourceRoleCatalogData;
  /** buildResourceRoleTables(): the column definitions of the Rates / Variants / Properties tables */
  tables: Record<ResourceRoleTableKey, ResourceRoleTableConfig>;
  /** the tab to start with (default 'main') */
  initialTab?: ResourceRoleTab;
}

const TABS: { key: ResourceRoleTab; label: string; icon: string }[] = [
  { key: 'main', label: 'Main', icon: 'engineering' },
  { key: 'rates', label: 'Cost', icon: 'sell' },
  { key: 'variants', label: 'Variants', icon: 'style' },
  { key: 'properties', label: 'Properties', icon: 'tune' },
];

function OwnerTable({ tableKey, tables, ownerGUID, hideColumn, testID }: {
  tableKey: 'rolePrice' | 'variant' | 'propertyValue'; tables: ResourceRoleEditModalCardProps['tables']; ownerGUID: string; hideColumn: string; testID: string;
}) {
  const def = RESOURCE_ROLE_TABLES[tableKey];
  return <OwnerRowsTable entity={def.entity} itemLabel={def.itemLabel} emptyRowJSON={def.emptyRowJSON} cfg={tables[tableKey]} ownerGUID={ownerGUID} hideColumn={hideColumn} testID={testID} />;
}

export default function ResourceRoleEditModalCard({ row, itemLabel, visualColumns, setCell, patchRow, onClose, testID, data, tables, initialTab = 'main' }: ResourceRoleEditModalCardProps) {
  const { themeColors: c, activeSystem, isDark, appleMacUITheme: apple } = useDesignSystem();
  const { width, height } = useWindowDimensions();
  const look = productModalLook(activeSystem, isDark, activeSystem === 'applemacui' ? apple?.colors?.backdrop : undefined);
  const [tab, setTab] = useState<ResourceRoleTab>(initialTab);
  const role = data.resourceRole.find((r) => r.rowGUID === row.rowGUID) ?? (row as any);
  const type = data.resourceRoleType.find((t) => t.rowGUID === role?.rowOwnerGUID);
  const variantOwner = variantOwnerOfRole(data, role);
  const counts: Record<ResourceRoleTab, number | undefined> = {
    main: undefined,
    rates: data.rolePrice.filter((p) => p.rowOwnerGUID === row.rowGUID).length,
    variants: variantsOfRole(data, role).length,
    properties: data.propertyValue.filter((p) => p.rowOwnerGUID === row.rowGUID).length,
  };
  const fields = useMemo(() => visualColumns.filter((col) => col.type !== 'rowNumber' && col.type !== 'custom'), [visualColumns]);
  const title = rowTitle(row as any);
  const subtitle = [type?.rowJSON?.title, type?.rowJSON?.baseUnit ? `cost per ${rowTitle(data.measureUnit.find((u) => u.rowGUID === type.rowJSON.baseUnit) as any) || type.rowJSON.baseUnit}` : null].filter(Boolean).join(' · ');
  const hair = { borderColor: c.border, borderWidth: 0, borderBottomWidth: look.hairline };
  const shadow = look.shadow === 'elevation' ? { elevation: 8 }
    : look.shadow === 'soft' ? (Platform.OS === 'web' ? ({ boxShadow: '0 12px 40px rgba(0,0,0,0.3)' } as any) : { elevation: 8 })
    : null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: look.backdrop }]} onPress={onClose}>
        <Pressable testID={testID} onPress={() => {}}
          style={[styles.window, shadow, { backgroundColor: c.surface, borderColor: c.border, borderWidth: look.borderWidth, borderRadius: look.radius, width: Math.min(width - 24, 980), height: Math.min(height - 40, 760) }]}>
          <View style={[styles.head, hair, look.headerBand ? { backgroundColor: look.headerBand } : null]}>
            <IconApp name="engineering" size={22} color={c.primary} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <TextApp testID={`${testID}-title`} variant="title" numberOfLines={1}>{title && title !== row.rowGUID ? title : `New ${itemLabel.toLowerCase()}`}</TextApp>
              {!!subtitle && <TextApp variant="caption" numberOfLines={1} style={{ opacity: 0.65 }}>{subtitle}</TextApp>}
            </View>
            <ButtonApp testID={`${testID}-close`} variant="toolbar" icon="close" accessibilityLabel="Close" onPress={onClose} />
          </View>

          <View style={[styles.tabs, hair]}>
            <SegmentButtonsApp testID={`${testID}-tabs`} compact value={tab} onValueChange={(v) => setTab(v as ResourceRoleTab)}
              buttons={TABS.map((t) => ({ value: t.key, label: counts[t.key] === undefined ? t.label : `${t.label} (${counts[t.key]})`, icon: t.icon, testID: `${testID}-tab-${t.key}` }))} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {tab === 'main' && (
              <View testID={`${testID}-main`} style={styles.form}>
                {fields.map((col) => (
                  <View key={col.key} style={[styles.field, width >= 760 && col.key !== 'description' ? { width: '48.5%' } : { width: '100%' }]}>
                    <MainField col={col} columns={visualColumns} row={row} setCell={setCell} patchRow={patchRow} testID={`${testID}-main`} />
                  </View>
                ))}
              </View>
            )}
            {tab === 'rates' && <OwnerTable tableKey="rolePrice" tables={tables} ownerGUID={row.rowGUID} hideColumn="role" testID={`${testID}-rates`} />}
            {tab === 'properties' && <OwnerTable tableKey="propertyValue" tables={tables} ownerGUID={row.rowGUID} hideColumn="role" testID={`${testID}-properties`} />}
            {tab === 'variants' && (isSet(variantOwner)
              ? (
                <View style={{ gap: 8 }}>
                  {variantOwner !== row.rowGUID && (
                    <TextApp testID={`${testID}-variants-owner`} variant="caption" style={{ opacity: 0.7 }}>
                      {`Variants of ${rowTitle(data.resourceRoleType.find((t) => t.rowGUID === variantOwner) ?? ({ rowGUID: variantOwner } as any))} - shared with the other roles of that role type.`}
                    </TextApp>
                  )}
                  <OwnerTable key={variantOwner} tableKey="variant" tables={tables} ownerGUID={variantOwner} hideColumn="owner" testID={`${testID}-variants`} />
                </View>
              )
              : <TextApp testID={`${testID}-variants-none`} style={{ opacity: 0.7 }}>The role type has no variants: the role itself is booked.</TextApp>)}
          </ScrollView>

          <View style={[styles.foot, { borderColor: c.border, borderTopWidth: look.hairline }]}>
            <TextApp variant="caption" style={{ opacity: 0.55, flex: 1 }}>Changes are saved as you make them.</TextApp>
            <ButtonApp testID={`${testID}-done`} title="Done" variant="contained" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
