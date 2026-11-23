// CatalogEditModalCard - the card of ONE catalog row with two tabs: Main (every editable column of the table as a form, the same fields as the in-place cells) and Translate
// (CatalogTranslationTable: the title / description of the row in other languages, SQL PART 56). It is the EditRowModalCard of a ReusableTable: row menu "Edit", or a click on a row
// of a READ ONLY table (uxuiTable.inlineEdit = false) - a catalog that is locked for editing can still be translated by who holds permissionTranslateCatalog.
// The window, the fields and the tabs are the ones of the Product card (productModalLook / MainField / modalCardStyles), so every design system looks the same.
//   const GenusCard = catalogEditCard('hub');   // ONE module level component per screen (a new component per render would remount the card and lose the open tab)
//   <ReusableTable EditRowModalCard={GenusCard} ... />
import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import TextApp from '../../ui/components/common/TextApp';
import ButtonApp from '../../ui/components/common/ButtonApp';
import SegmentButtonsApp from '../../ui/components/common/SegmentButtonsApp';
import type { EditRowModalCardProps } from '../../ui/components/table/reusable/reusableTableTypes';
import { MainField, modalCardStyles, productModalLook } from '../product/card/ProductItemEditModalCard';
import { rowTitle } from '../product/crud/productCatalogTools';
import CatalogTranslationTable from './CatalogTranslationTable';
import { useCatalogTranslationVersion } from './catalogTranslationStore';

export type CatalogEditTab = 'main' | 'translate';

const TABS: { key: CatalogEditTab; label: string; icon: string }[] = [
  { key: 'main', label: 'Main', icon: 'inventory_2' },
  { key: 'translate', label: 'Translate', icon: 'translate' },
];

export interface CatalogEditModalCardProps extends EditRowModalCardProps {
  /** the icon of the header */
  icon?: string;
  /** the tab to start with (default 'main') */
  initialTab?: CatalogEditTab;
}

export default function CatalogEditModalCard({ row, itemLabel, visualColumns, setCell, patchRow, onClose, testID, icon = 'inventory_2', initialTab = 'main' }: CatalogEditModalCardProps) {
  const { themeColors: c, activeSystem, isDark, appleMacUITheme: apple } = useDesignSystem();
  const { width, height } = useWindowDimensions();
  const look = productModalLook(activeSystem, isDark, activeSystem === 'applemacui' ? apple?.colors?.backdrop : undefined);
  const [tab, setTab] = useState<CatalogEditTab>(initialTab);
  useCatalogTranslationVersion(); // the title in the header follows the interface language
  const fields = useMemo(() => visualColumns.filter((col) => col.type !== 'rowNumber' && col.type !== 'custom'), [visualColumns]);
  const title = rowTitle(row as any);
  const hair = { borderColor: c.border, borderWidth: 0, borderBottomWidth: look.hairline };
  const shadow = look.shadow === 'elevation' ? { elevation: 8 }
    : look.shadow === 'soft' ? (Platform.OS === 'web' ? ({ boxShadow: '0 12px 40px rgba(0,0,0,0.3)' } as any) : { elevation: 8 })
    : null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={[modalCardStyles.backdrop, { backgroundColor: look.backdrop }]} onPress={onClose}>
        <Pressable testID={testID} onPress={() => {}}
          style={[modalCardStyles.window, shadow, { backgroundColor: c.surface, borderColor: c.border, borderWidth: look.borderWidth, borderRadius: look.radius, width: Math.min(width - 24, 860), height: Math.min(height - 40, 680) }]}>
          <View style={[modalCardStyles.head, hair, look.headerBand ? { backgroundColor: look.headerBand } : null]}>
            <IconApp name={icon} size={22} color={c.primary} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <TextApp testID={`${testID}-title`} variant="title" numberOfLines={1}>{title && title !== row.rowGUID ? title : `New ${itemLabel.toLowerCase()}`}</TextApp>
            </View>
            <ButtonApp testID={`${testID}-close`} variant="toolbar" icon="close" accessibilityLabel="Close" onPress={onClose} />
          </View>

          <View style={[modalCardStyles.tabs, hair]}>
            <SegmentButtonsApp testID={`${testID}-tabs`} compact value={tab} onValueChange={(v) => setTab(v as CatalogEditTab)}
              buttons={TABS.map((t) => ({ value: t.key, label: t.label, icon: t.icon, testID: `${testID}-tab-${t.key}` }))} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={modalCardStyles.body} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {tab === 'main' && (
              <View testID={`${testID}-main`} style={modalCardStyles.form}>
                {fields.map((col) => (
                  <View key={col.key} style={[modalCardStyles.field, width >= 760 && col.key !== 'description' ? { width: '48.5%' } : { width: '100%' }]}>
                    <MainField col={col} columns={visualColumns} row={row} setCell={setCell} patchRow={patchRow} testID={`${testID}-main`} />
                  </View>
                ))}
              </View>
            )}
            {tab === 'translate' && <CatalogTranslationTable catalogItemGUID={row.rowGUID} testID={`${testID}-translate`} />}
          </ScrollView>

          <View style={[modalCardStyles.foot, { borderColor: c.border, borderTopWidth: look.hairline }]}>
            <TextApp variant="caption" style={{ opacity: 0.55, flex: 1 }}>Changes are saved as you make them.</TextApp>
            <ButtonApp testID={`${testID}-done`} title="Done" variant="contained" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** ONE stable EditRowModalCard component for a screen: `const GenusCard = catalogEditCard('hub')` at module level */
export function catalogEditCard(icon: string, initialTab: CatalogEditTab = 'main') {
  return function CatalogRowCard(p: EditRowModalCardProps) {
    return <CatalogEditModalCard {...p} icon={icon} initialTab={initialTab} />;
  };
}
