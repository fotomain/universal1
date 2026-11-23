// CatalogTranslationTable - the Translate tab of a catalog card: a ReusableTable with the translations of ONE catalog item (SQL PART 56, catalogTranslationTable).
// A row = language + the field that is translated (Title | Description, chosen in the row) + the translated text. The item (rowOwnerGUID) comes from the card, never from the row.
// "+" gives a new row the first language / field pair that is still free (the database allows one row per item + language + field).
// Who may write: permissionTranslateCatalog (usePermissions().canTranslateCatalog); everybody else sees the rows read only. The database decides - this only hides the buttons.
import React, { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import ReusableTable from '../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableRow, VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import { usePermissions } from '../../permissions/usePermissions';
import { CATALOG_TRANSLATION_TABLE, LANGUAGE_OPTIONS, nextFreeTranslation, TRANSLATION_FIELD_OPTIONS } from './catalogTranslationModel';

export interface CatalogTranslationTableProps {
  /** the rowGUID of the catalog item that is translated (any catalog) */
  catalogItemGUID: string;
  testID?: string;
}

export const CATALOG_TRANSLATION_COLUMNS: VisualColumn[] = [
  { key: 'language', title: 'Language', type: 'select', target: 'rowParentGUID', options: LANGUAGE_OPTIONS, allowEmpty: false, width: 190, placeholder: 'Select language…' },
  { key: 'translationField', title: 'Field', type: 'select', options: TRANSLATION_FIELD_OPTIONS, allowEmpty: false, width: 140, placeholder: 'Select field…' },
  { key: 'translationText', title: 'Translation', type: 'text', width: 420, placeholder: 'Translated text' },
];

export default function CatalogTranslationTable({ catalogItemGUID, testID = 'catalog-translation' }: CatalogTranslationTableProps) {
  const t = CATALOG_TRANSLATION_TABLE;
  const { canTranslateCatalog } = usePermissions();
  const rows: any[] | undefined = useSelector((s: any) => s?.[t.entity]?.entityDataFromServer);
  const rowFilter = useMemo(() => (row: ReusableTableRow) => row.rowOwnerGUID === catalogItemGUID, [catalogItemGUID]);
  const newRowDefaults = useCallback(() => {
    const free = nextFreeTranslation(rows, catalogItemGUID);
    return { rowOwnerGUID: catalogItemGUID, ...(free ? { rowParentGUID: free.language, rowJSON: { translationField: free.field, translationText: '' } } : {}) };
  }, [rows, catalogItemGUID]);
  const noFreePair = nextFreeTranslation(rows, catalogItemGUID) === null;

  return (
    <ReusableTable
      testID={testID}
      entityName={t.entity}
      crudListTitle="Translations"
      itemLabel={t.itemLabel}
      listOwnerGUID={REUSABLE_TABLE_ALL}
      listParentGUID={REUSABLE_TABLE_ALL}
      visualColumns={CATALOG_TRANSLATION_COLUMNS}
      defaultRowJSON={t.emptyRowJSON}
      rowFilter={rowFilter}
      newRowDefaults={newRowDefaults}
      readOnly={!canTranslateCatalog}
      addEnabled={canTranslateCatalog && !noFreePair}
      deleteEnabled={canTranslateCatalog}
      realtime
      resizeColumnWidth
      emptyText={canTranslateCatalog ? 'No translations yet. Press "+" to add one.' : 'No translations yet.'}
      uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch' }}
    />
  );
}
