# Legal entities - `kit8/catalog/legal_entity`

`legalEntityTable` - OUR companies that vendor invoices are issued to (`VendorInvoiceLegalEntity`). A plain def-table catalog: rowOwnerGUID `legalEntityCatalog` · **rowParentGUID = the folder = the GUID of a country (`countryTable`) or `'empty'`** · rowJSON `{ title, legalName, registrationNo, vatNo, legalAddress, description, isActive }`.

* **Folders by country**: the tree is derived from the country catalog (no folder table): only the countries that have a legal entity, all of them with the button in the header. The DB guard refuses a folder that is not a country; a legal entity used by a contract or a vendor invoice is not deleted (set it inactive).
* `contractTable.rowJSON.legalEntityGUID` - **optional** (a contract without one works as before); a value must be an existing legal entity (guard); a select in the contract card.
* Route `/catalog/legal/entity` (drawer: **Catalogs → Legal entities**) → `LegalEntityCRUD.tsx` (a `ReusableTable` with CRUD and the folders tree). SQL: PART 26 of `kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql`.

| File | What |
|---|---|
| `legalEntityModel.ts` | table, route, titles, the country folders, the picker list |
| `legalEntityMetaData.ts` | SystemMetaData entry |
| `useLegalEntityData.ts` | rows + countries from redux (read + realtime) |
| `LegalEntityCRUD.tsx` | the screen |
