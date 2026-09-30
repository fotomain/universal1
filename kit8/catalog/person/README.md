# Person catalog (`kit8/catalog/person`)

Hamburger menu → **Catalogs** → **Persons** → `/person/list` · add / edit → `/person/edit` (`?rowGUID=…` for an existing person).

## Setup

Run `kit8/sql/init/create_person_table.sql` in the Supabase SQL editor: creates `public."personTable"`, RLS policies (restricted to `authenticated` users for GDPR compliance), GIN index, and adds the table to `supabase_realtime` publication.

## Data

| column | value |
|---|---|
| `rowGUID` | uuid text |
| `rowOwnerGUID` | `'personCatalog'` (shared catalog, `PERSON_CATALOG_OWNER`) |
| `rowParentGUID` | `'empty'` |
| `orderInList` | list order (drag & drop on web) |
| `rowJSON` | `{ personFirstName, personLastName, personTitle, personEmail, personPhone, isActive, personIsEmployee, employeeData }` |

React: `export const personsTable = "personTable"` (`personModel.ts`), redux entity `personReusable` (`kit8/redux/SystemMetaData.ts`).

## Features

* **Auto-generated display title**: `personTitle` is automatically filled as `"First Last"` if left blank.
* **Employee sub-section**: Controlled by `personIsEmployee`. Turning the flag off hides the fields in the UI without deleting the stored `employeeData`.
* **Embedded Contracts**: Once saved, `PersonEdit` renders the embedded `ContractList` displaying active contracts associated with the person.
* **Deletion Protection**: A person with associated contracts cannot be hard deleted — users are prompted to set `isActive = false` instead.
