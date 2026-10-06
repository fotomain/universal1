// SelectElementFromCatalog.tsx
// Generic catalog element selector that queries Redux/Supabase Realtime entities
// and filters by rowParentGUID and/or rowOwnerGUID with instant search and clear.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';

export interface SelectElementFromCatalogProps {
  /** SystemMetaData entity key (e.g. 'partnerReusable', 'contractReusable') */
  entityName: string;
  /** Current selected rowGUID */
  value?: string | null;
  /** Callback fired when an item is selected or cleared */
  onChange?: (guid: string | null, row?: any) => void;
  /** Alias callback for selection */
  onSelect?: (guid: string | null, row?: any) => void;
  /** Filter items by rowOwnerGUID (e.g. partner rowGUID for contracts) */
  rowOwnerGUID?: string;
  /** Filter items by rowParentGUID (e.g. 'partner' or 'person') */
  rowParentGUID?: string;
  /** Optional client-side predicate filter (e.g. (p) => p.rowJSON?.partnerIsSupplier) */
  filterItem?: (row: any) => boolean;
  /** Label rendered above the selector */
  label?: string;
  /** Placeholder text when nothing is selected */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Optional message displayed when disabled (e.g. "Select a supplier first") */
  disabledMessage?: string;
  /** Custom function to extract item title */
  titleExtractor?: (row: any) => string;
  /** Custom function to extract item subtitle */
  subtitleExtractor?: (row: any) => string | undefined;
  /** testID for automated tests */
  testID?: string;
  /** Whether to scope the DB fetch by rowOwnerGUID in match params (default false: in-memory filtering) */
  scopeFetchByOwner?: boolean;
}

export function defaultTitleExtractor(row: any): string {
  if (!row) return '';
  const j = row.rowJSON || {};
  // Country
  if (j.countryName) {
    const flag = j.flagEmoji ? `${j.flagEmoji} ` : '';
    const code = j.countryCode ? ` (${j.countryCode})` : '';
    return `${flag}${j.countryName}${code}`;
  }
  // Departament
  if (j.departmentName) {
    const code = j.departmentCode ? `[${j.departmentCode}] ` : '';
    return `${code}${j.departmentName}`;
  }
  if (j.partnerTitle) return j.partnerTitle;
  if (j.contractNumber && j.contractTitle) return `${j.contractNumber} — ${j.contractTitle}`;
  if (j.contractTitle) return j.contractTitle;
  if (j.personTitle) return j.personTitle;
  if (j.name) return j.name;
  if (j.title) return j.title;
  return row.rowGUID || '';
}

export function defaultSubtitleExtractor(row: any): string | undefined {
  if (!row) return undefined;
  const j = row.rowJSON || {};
  // Country
  if (j.countryCode || j.phonePrefix || j.currencyCode) {
    const parts = [
      j.countryCodeAlpha3 || j.countryCode,
      j.phonePrefix ? `📞 ${j.phonePrefix}` : null,
      j.currencyCode ? `💱 ${j.currencyCode}` : null,
    ].filter(Boolean);
    return parts.join(' · ');
  }
  // Departament
  if (j.headPersonName || j.description) {
    return [j.headPersonName ? `Lead: ${j.headPersonName}` : null, j.description].filter(Boolean).join(' · ');
  }
  // Partner
  if (j.legalData?.vatNo) return `VAT: ${j.legalData.vatNo}`;
  if (j.partnerLegalName && j.partnerLegalName !== j.partnerTitle) return j.partnerLegalName;
  // Contract
  if (j.contractStartDate || j.contractTotal !== undefined) {
    const parts = [
      j.contractStartDate ? `${j.contractStartDate}${j.contractFinishDate ? ` → ${j.contractFinishDate}` : ''}` : null,
      j.contractTotal !== undefined ? `${j.contractTotal} ${j.contractCurrency || ''}` : null,
      j.contractPaymentsPeriod ? `/${j.contractPaymentsPeriod}` : null,
    ].filter(Boolean);
    return parts.join(' · ');
  }
  // Person
  if (j.personEmail) return j.personEmail;
  if (j.employeeData?.position) return j.employeeData.position;
  return undefined;
}

export default function SelectElementFromCatalog({
  entityName,
  value,
  onChange,
  onSelect,
  rowOwnerGUID,
  rowParentGUID,
  filterItem,
  label,
  placeholder = 'Select element...',
  disabled = false,
  disabledMessage,
  titleExtractor = defaultTitleExtractor,
  subtitleExtractor = defaultSubtitleExtractor,
  testID = 'select-element-from-catalog',
  scopeFetchByOwner = true,
}: SelectElementFromCatalogProps) {
  const { themeColors: c } = useDesignSystem();
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Realtime subscription scoped by rowOwnerGUID and/or rowParentGUID
  const readParams = useMemo(() => {
    const match: Record<string, any> = {};
    if (scopeFetchByOwner !== false && rowOwnerGUID !== undefined) match.rowOwnerGUID = rowOwnerGUID;
    if (rowParentGUID !== undefined) match.rowParentGUID = rowParentGUID;
    return {
      paginationSize: 1000,
      originationCurrentPage: 0,
      ...(Object.keys(match).length > 0 ? { match } : {}),
    };
  }, [scopeFetchByOwner, rowOwnerGUID, rowParentGUID]);

  useRealtimeEntity(entityName, { readParams, enabled: !disabled && Boolean(entityName) });

  const allRows: any[] = useSelector((s: any) => s?.[entityName]?.entityDataFromServer) || [];

  // Filter items according to rowOwnerGUID, rowParentGUID, and custom filterItem
  const availableItems = useMemo(() => {
    let list = allRows;
    if (rowOwnerGUID !== undefined) {
      list = list.filter((r) => r.rowOwnerGUID === rowOwnerGUID);
    }
    if (rowParentGUID !== undefined) {
      list = list.filter((r) => r.rowParentGUID === rowParentGUID);
    }
    if (filterItem) {
      list = list.filter(filterItem);
    }
    return [...list].sort((a, b) => (a.orderInList ?? 0) - (b.orderInList ?? 0));
  }, [allRows, rowOwnerGUID, rowParentGUID, filterItem]);

  // Selected item (matches by rowGUID, or countryCode / ISO code)
  const selectedItem = useMemo(() => {
    if (!value) return null;
    return (
      allRows.find(
        (r) =>
          r.rowGUID === value ||
          (r.rowJSON?.countryCode && r.rowJSON.countryCode.toUpperCase() === value.toUpperCase()) ||
          (r.rowJSON?.countryCodeAlpha3 && r.rowJSON.countryCodeAlpha3.toUpperCase() === value.toUpperCase())
      ) || null
    );
  }, [allRows, value]);

  const selectedTitle = selectedItem ? titleExtractor(selectedItem) : '';

  // Filtered in modal by search query
  const modalItems = useMemo(() => {
    if (!searchQuery.trim()) return availableItems;
    const q = searchQuery.toLowerCase().trim();
    return availableItems.filter((item) => {
      const title = titleExtractor(item).toLowerCase();
      const sub = (subtitleExtractor(item) || '').toLowerCase();
      return title.includes(q) || sub.includes(q);
    });
  }, [availableItems, searchQuery, titleExtractor, subtitleExtractor]);

  const selectedIndex = useMemo(() => {
    if (!value) return -1;
    return modalItems.findIndex((item) => item.rowGUID === value);
  }, [modalItems, value]);

  const flatListRef = useRef<FlatList<any>>(null);

  useEffect(() => {
    if (modalOpen && selectedIndex >= 0) {
      const timer = setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({ index: selectedIndex, animated: false, viewPosition: 0.5 });
        } catch {}
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [modalOpen, selectedIndex]);

  const handlePick = (item: any) => {
    onChange?.(item.rowGUID, item);
    onSelect?.(item.rowGUID, item);
    setModalOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    onChange?.(null, null);
    onSelect?.(null, null);
  };

  const openPicker = () => {
    if (disabled) return;
    setSearchQuery('');
    setModalOpen(true);
  };

  const displayText = disabled && disabledMessage ? disabledMessage : selectedTitle || placeholder;

  return (
    <View style={styles.container}>
      {!!label && <Text style={[styles.label, { color: c.text }]}>{label}</Text>}

      <View
        testID={testID}
        style={[
          styles.triggerBox,
          {
            borderColor: c.border,
            backgroundColor: disabled ? `${c.border}20` : c.surface,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <Pressable
          testID={`${testID}-trigger`}
          disabled={disabled}
          onPress={openPicker}
          style={styles.triggerPressable}
          accessibilityRole="button"
          accessibilityLabel={label || 'Select element'}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.triggerText,
              {
                color: selectedItem ? c.text : `${c.text}88`,
                fontWeight: selectedItem ? '600' : '400',
              },
            ]}
          >
            {displayText}
          </Text>
        </Pressable>

        {!!selectedItem && !disabled && (
          <Pressable
            testID={`${testID}-clear`}
            onPress={handleClear}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Clear selection"
          >
            <IconApp name="close" size={16} color={c.text} />
          </Pressable>
        )}

        <Pressable
          disabled={disabled}
          onPress={openPicker}
          style={styles.iconButton}
        >
          <IconApp name="expand_more" size={18} color={disabled ? `${c.text}44` : c.text} />
        </Pressable>
      </View>

      {modalOpen && (
        <Modal
          visible={modalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              testID={`${testID}-modal`}
              style={[
                styles.modalCard,
                {
                  backgroundColor: c.surface,
                  borderColor: c.border,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: c.text }]}>
                  {label ? `Select ${label}` : 'Select Element'}
                </Text>
                <Pressable
                  testID={`${testID}-modal-close`}
                  onPress={() => setModalOpen(false)}
                  style={styles.iconButton}
                >
                  <IconApp name="close" size={20} color={c.text} />
                </Pressable>
              </View>

              <View style={[styles.searchBox, { borderColor: c.border, backgroundColor: `${c.border}15` }]}>
                <IconApp name="search" size={18} color={c.text} />
                <TextInput
                  testID={`${testID}-search-input`}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search..."
                  placeholderTextColor={`${c.text}80`}
                  style={[styles.searchInput, { color: c.text }]}
                  autoFocus
                />
                {!!searchQuery && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <IconApp name="close" size={16} color={c.text} />
                  </Pressable>
                )}
              </View>

              <FlatList
                ref={flatListRef}
                data={modalItems}
                keyExtractor={(item) => item.rowGUID}
                initialScrollIndex={selectedIndex > 0 ? selectedIndex : undefined}
                onScrollToIndexFailed={({ index }) => {
                  setTimeout(() => flatListRef.current?.scrollToIndex({ index, animated: false }), 50);
                }}
                style={styles.list}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: `${c.text}88` }]}>
                      {availableItems.length === 0
                        ? 'No elements found in catalog.'
                        : 'No matches found.'}
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isSelected = item.rowGUID === value;
                  const itemTitle = titleExtractor(item);
                  const itemSubtitle = subtitleExtractor(item);

                  return (
                    <Pressable
                      testID={`${testID}-item-${item.rowGUID}`}
                      onPress={() => handlePick(item)}
                      style={[
                        styles.listItem,
                        {
                          borderColor: isSelected ? c.primary : `${c.border}40`,
                          borderWidth: isSelected ? 2 : 1,
                          backgroundColor: isSelected ? `${c.primary}15` : 'transparent',
                        },
                      ]}
                      accessibilityState={{ selected: isSelected }}
                      aria-selected={isSelected}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.itemTitle,
                              {
                                color: isSelected ? c.primary : c.text,
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {itemTitle}
                          </Text>
                          {isSelected && (
                            <View style={[styles.activeBadge, { backgroundColor: `${c.primary}25` }]}>
                              <Text style={[styles.activeBadgeText, { color: c.primary }]}>Active</Text>
                            </View>
                          )}
                        </View>
                        {!!itemSubtitle && (
                          <Text
                            style={[styles.itemSubtitle, { color: `${c.text}90` }]}
                            numberOfLines={1}
                          >
                            {itemSubtitle}
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <IconApp name="check_circle" size={18} color={c.primary} />
                      )}
                    </Pressable>
                  );
                }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  triggerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  triggerPressable: {
    flex: 1,
    paddingVertical: 8,
  },
  triggerText: {
    fontSize: 14,
  },
  iconButton: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    maxHeight: 520,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(0,0,0,0.2)' },
      default: { elevation: 8 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    minHeight: 36,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 6,
    paddingVertical: 6,
  },
  list: {
    maxHeight: 340,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 14,
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  activeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
