# Equipment catalog (`kit8/catalog/equipment`)

A machine or a tool that works on a task and is **booked by the hour on a Time line** (`task_line_table.rowJSON.taskResourceKind = 'equipment'`). The analog of the person catalog
(`kit8/catalog/person`) for things: it has **Properties** (what it IS: Engine power 110 kW), **Variants** (what it can be BOOKED AS: Heavy, With operator) and is picked on a Time line.
Design and reasons: `recommendation/EQUIPMENT_TIME.html`.

Hamburger menu → **Equipment (properties and variants)** → `/catalog/equipment/dashboard` (`?tab=<table key>|checks &focusRowGUID=<rowGUID>`).

## Setup

`kit8/sql/start/start_sql_structure.sql` (PART 17; the opposite is PART 6 of `delete_sql_structure.sql`): `equipmentTypeTable`, `equipmentTable`, the descriptors (Class, Hire mode, Engine power,
Min. engine power, Year), 2 types (Heavy machinery, Vehicle) with their sets, 6 demo machines with properties and variants, the role type **Equipment Resources** (4 roles, requirements, variants, hourly
rates) and the CHECK of `task_line_table.rowJSON.taskResourceKind`. Idempotent. Test it on Postgres 15: `cd kit8/docker && docker compose up -d && ./test_sql.sh`.

## Data

| table | rowOwnerGUID | rowParentGUID | rowJSON |
|---|---|---|---|
| `equipmentTypeTable` | `equipmentTypeCatalog` | `empty` | `{ title, description, propertySet, variantSet, variantMode ('perProduct'), uniqueVariants, variantTitleTemplate, isActive }` - **the kind of machine** (decides the descriptor sets), like a person type |
| `equipmentTable` | `equipmentCatalog` | `empty` | `{ equipmentTitle, equipmentCode (unique), equipmentType, equipmentOwnership ('own' \| 'rented' \| 'leased'), equipmentManufacturer, equipmentModel, equipmentSerialNumber, isActive }` |

Ownership is a plain field, NOT the type: the descriptors depend on the kind of machine (a crane has Lifting capacity), ownership will decide where a cost comes from (a lessor contract - not built yet).
The title is "manufacturer + model" when empty. An equipment has **no rates and no contract**: the hour is costed by the rate of the **resource role** of the line (`rolePriceTable`, role type with
`resourceKind = 'equipment'`).

## The descriptor concept (shared with products, roles and persons)

| | role (what the line ASKS) | equipment (what it HAS) |
|---|---|---|
| Property | Min. engine power 100 kW | Engine power 122 kW, Year 2019 (`satisfies: 'minEnginePowerKw'`, `matchRule: 'atLeast'`) |
| Variant | Heavy, With operator | Heavy · With operator, Heavy · Dry hire |
| Set owner | role type | **equipment type** |
| Value owner | role (properties) / role type (variants) | the **equipment** (properties and variants) |

`equipmentAsProductData()` (`equipmentTypeModel.ts`) shows the equipment to the descriptor rules as a product catalog (type = product type, equipment = product): the rules, labels and validation are
written ONCE (`product/crud`). The two sides meet on the DESCRIPTOR (genus + value), never on the plan line (`kit8/pm/view/task/finances/taskLinePersonMatch.ts`).

**Sides of the shared tables**: `descriptorDestination / Plan / propertyValue / variant / variantValue` hold the rows of FOUR sides (products, roles, persons, equipment). The list of the sides is ONE
registry, `product/crud/descriptorSides.ts`; every dashboard hides the other three with `otherSideEntities(its side)` - a fifth side is one line there.

## Screen

`dashboard/EquipmentDashboard.tsx` (the twin of `PersonDashboard`): **Checks** (rules R1-R12 + E1, `equipmentValidation.ts`) and 9 `ReusableTable`s - Equipment, Equipment types, Descriptors, Values, Sets, Plan
lines, Properties, Variants, Variant values - with filters (master → detail: the properties of ONE equipment), row menus, Generate variants, Rebuild variant titles / keys.

## Files

`equipmentModel.ts` (table, row shape, normalize, validate, title) · `equipmentTypeModel.ts` (type table, `equipmentAsProductData`) · `equipmentValidation.ts` (Checks) · `equipmentMetaData.ts` (redux entities,
spread into `kit8/redux/SystemMetaData.ts`) · `dashboard/` (model, tables, data hook, screen). Tests: `__tests__/catalog/equipment` (model, SQL text, dashboard), `__tests__/catalog/product/descriptorSides.test.ts`,
`__tests__/pm/view/task/finances/taskLineResource.test.ts` (the Time line).
