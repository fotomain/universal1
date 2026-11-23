// translatedTitleColumns() - the READ ONLY column "<Title> (LV)" of a catalog table: the title of the row in the INTERFACE language (catalogTranslationStore), put right after the
// editable Title column. It is there only while the active language has a translation (no empty column otherwise). The screen calls useCatalogTranslationVersion() and adds the
// number to the deps of the useMemo that builds its columns, so the column appears / disappears with the language.
import React from 'react';
import { Text } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import type { VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import { catalogTranslationCount, catalogTranslationLanguage, translatedTitle } from './catalogTranslationStore';

function TranslatedTitleCell({ guid }: { guid: string }) {
  const { themeColors: c } = useDesignSystem();
  return <Text numberOfLines={1} testID={`translated-title-${guid}`} style={{ color: c.text, opacity: 0.8, fontSize: 13, flex: 1 }}>{translatedTitle(guid) ?? ''}</Text>;
}

export function translatedTitleColumns(width = 200): VisualColumn[] {
  if (catalogTranslationCount() === 0) return [];
  return [{
    key: 'titleTranslated', title: `Title (${catalogTranslationLanguage().toUpperCase()})`, type: 'custom', width, editable: false,
    renderCell: (row) => <TranslatedTitleCell guid={row.rowGUID} />,
    searchText: (row) => translatedTitle(row.rowGUID) ?? '',
  }];
}
