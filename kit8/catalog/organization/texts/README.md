# Application texts of an organization (W1 PERMISSIONS, section 10)

An administrator replaces, for the WHOLE organization and per language, a **menu title**, a **column header** or a **title**. SQL: PART 48 (`organizationTextTable`, `organization_texts(language)`); Docker `tests/54`; Jest `__tests__/catalog/organization/organizationTexts*.test.*`.

| kind | key | where it is read |
|---|---|---|
| `menu` | the i18next key (`menu.home`) | `t()` - a post processor `orgTexts` registered in `kit8/i18n/i18n.ts` |
| `title` | the English text of `pmT` | `pmT` (`kit8/pm/i18n/pmT.ts`) - screen, window and section titles, labels |
| `column` | `<table>.<column key>` | the header of a column of `ReusableTable` (`columnTitleOf`) |

Row: `rowOwnerGUID` = organization, `rowParentGUID` = language code, `rowJSON { textKind, textKey, text }`; unique per organization + language + kind + key. A missing row = the delivered text. Written by the administrator (RLS), read by the members.

- `kit8/i18n/organizationTexts.ts` - the store (`setOrganizationTexts`, `organizationText`, `columnTitleOf`).
- `OrganizationTextsHost` (mounted in `app/_layout.tsx`) - one `organization_texts` call after the sign in and on a language change.
- `OrganizationTextsCRUD` (route `/catalog/organization/texts`, Drawer: System settings -> Application texts): a table of the delivered texts with the cell "Organization text"; clearing the cell (or typing the delivered text) = Reset to delivered. The "Add" bar takes a column key.
- **Phase 1: a change is seen after a reload of the app** (no live switching).
