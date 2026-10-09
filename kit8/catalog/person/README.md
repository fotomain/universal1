# Person catalog (`kit8/catalog/person`)

Hamburger menu → **Catalogs** → **Persons** → `/person/list` · add / edit → `/person/edit` (`?rowGUID=…` for an existing person).
**Persons (properties and variants)** → `/catalog/person/dashboard` - person types, descriptor sets, Properties and Variants of the persons (ReusableTable approach, no folders).

## Setup

All SQL files in the right order: `kit8/sql/init/RUN_ORDER.md` (person types: step 5, person descriptors + contracts: step 6).
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

## Person types, Properties and Variants (the descriptor concept)

A person has his OWN Properties and Variants, separate from the ones of a role, on the same descriptor tables as the products and the roles
("W1 V3 ER DESCRIPTORS PLAN", rule R12 mirrored):

| | role (what the line ASKS) | person (what he HAS) |
|---|---|---|
| Property | what the role requires: Min. experience 5, Certification PMP | what he is: Experience 7 years, Certification PMP + PL-300 (**one row per certificate**) |
| Variant | what is booked: Senior, English | what he can be booked as: Senior·English, Senior·Latvian |
| Set owner | role type | **person type** (`personTypeTable`: Employee, Contractor) |
| Value owner | role (properties) / role type (variants) | the **person** (properties and variants) |

* `personTable.rowJSON.personType` = the type (the owner stays `personCatalog`); `personIsEmployee` follows it (Employee = true). `personAsProductData()`
  (`personTypeModel.ts`) shows persons as products owned by their type, so the descriptor rules, labels and validation are written once.
* A descriptor with `"multiple": true` (Certification) may have several property rows for one person. `"satisfies"` says which role descriptor it answers
  (Experience, years answers Min. experience); `"matchRule"`: 'atLeast' (numbers) | 'includes' (lists).
* The three sides share `descriptorDestination / Plan / propertyValue / variant / variantValue`: each dashboard hides the rows of the other two (`catalogSides.ts`).
* **Persons dashboard** (`dashboard/PersonDashboard.tsx`): Checks (rules R1-R12, P1) + 9 ReusableTables (Persons, Person types, Descriptors, Values, Sets, Plan lines,
  Properties, Variants, Variant values), filters (the properties of ONE person), Generate variants.
* The Time line of a task uses it: `kit8/pm/view/task/finances/README.md` (Person variant, cost from the person's contract).
* Cost: a person has no rates of his own; a Time line takes the cost from his contract, else from the rate of the resource role.
* SQL: `create_person_type_table.sql` (types + 50 % Employee / 50 % Contractor), `create_person_descriptors.sql` (sets, properties, variants, contracts).
