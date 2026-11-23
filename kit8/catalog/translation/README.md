# Catalog translations (SQL PART 56, 2026-11-23)

The **title** and the **description** of ANY catalog item in another language. Where the Translate tab is: the Product card (`ProductItemEditModalCard`, after Properties) and, since 2026-11-23, **management genus, activity genus, business units, budget items** through the generic card `CatalogEditModalCard` (tabs Main + Translate; `const Card = catalogEditCard(icon)` at module level, passed as `EditRowModalCard` of the `ReusableTable`, or of `CatalogTreeReusableCRUD`). Menu Edit opens it; in a READ ONLY catalog (`noCrud`, `inlineEdit: false`) a click on a row opens it - a locked catalog can still be translated by who holds the permission. Another catalog card adds `<CatalogTranslationTable catalogItemGUID={row.rowGUID} />` as a tab, or uses `catalogEditCard`.

| table | row |
|---|---|
| `language_catalog` | `rowGUID` = the language code (en, lv, ru ...), the 15 languages of `LANGUAGES` (`kit8/i18n/i18n.ts`), seeded in start4 / start5 PART 56; read only for clients |
| `catalogTranslationTable` | `rowOwnerGUID` = the GUID of the catalog item · `rowParentGUID` = the language (FK to `language_catalog`) · `rowJSON { translationField: 'title' \| 'description', translationText }` |

Unique: item + language + **field** (`uq_catalogTranslation`) - so one item has a title AND a description per language. A missing row = the item's own text. The text is trimmed by the trigger `catalog_translation_guard`; the item of a row is never moved; the language and the field may be changed in the row.

## Who may write: `permissionTranslateCatalog`
`permission_translate_catalog()` (start2 PART 56) is true for: the **organization administrator**, a **project manager** (`permissionProjectManager` held anywhere in the active organization), an **application administrator** (`permission_application_admin()`), or a user the administrator gave it to (a row of `project_permission_profile_user_table`, `rowOwnerGUID` = the organization, `permissionProfileGUID = 'permissionTranslateCatalog'`). It is NOT one of the 11 matrix profiles (no letters per table). Everybody signed in reads. The policies of `catalogTranslationTable` use the function; `perm_my_matrix` answers `canTranslateCatalog` (+ lists the name in `profiles`); the interface is `usePermissions().canTranslateCatalog` (true until the answer is there), which makes the table read only and hides + / delete.

## Interface
`CatalogTranslationTable` = a `ReusableTable` of the rows of one item (`rowFilter` on `rowOwnerGUID`): columns Language (select, `rowParentGUID`) · Field (select Title / Description) · Translation (text). `+` gives the first language / field pair that has no row yet (`nextFreeTranslation`) and is disabled when all 30 are used.

## The interface language shows the translated title (2026-11-23)
`CatalogTranslationsHost` (mounted in `app/_layout.tsx`) reads the rows of the INTERFACE language after the sign in (`rowParentGUID = language`, paged), again on a language change and (debounced) on a realtime change, and fills `catalogTranslationStore`. A translated TITLE is then shown wherever a catalog title is only DISPLAYED: `rowTitle` (`productCatalogTools`: select options, labels, card header, reports that name a catalog row) and `defaultTitleExtractor` (`SelectElementFromCatalog`). The catalog tables above get the same read only **Title (LV)** column (`translatedTitleColumns()`; the screen adds `useCatalogTranslationVersion()` to the deps of its columns). The Products table keeps its own editable **Title** and gets a read only **Title (LV)** column while a translation exists. No translation in the language = the item's own text. An EDITABLE cell never shows the translation (saving it would overwrite the item). A component that builds labels in a `useMemo` adds `useCatalogTranslationVersion()` to the deps.

## Not built / limits
- The DESCRIPTION translation is stored and kept in the store (`translatedDescription`) but no screen shows it yet.
- Folders of the genus / budget item trees are rows too but have no card (the tree has no Edit): their titles cannot be translated yet; the descriptor genus (a table of the Product dashboard) has no card yet.
- Titles shown by code that does not go through `rowTitle` / `defaultTitleExtractor` (a catalog with its own title code: partners, persons, countries ...) are still the item's own text.
- Translations of a deleted catalog item stay (no cascade: the item may be in any table).
- A user is given the permission by a row in `project_permission_profile_user_table` only - the Members / Organization members screens do not offer it yet.
- The table is not in the permission matrix (153 tables): its own policies decide.

Tests: Docker `kit8/docker/tests/105_catalog_translation.sql` (28 checks), Jest `__tests__/catalog/translation`, the Translate tab case of `__tests__/catalog/product/productsWithTree.test.tsx`.
