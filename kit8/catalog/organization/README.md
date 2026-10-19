# Organization (`kit8/catalog/organization`)

A user belongs to **one organization** (`userTable.rowJSON.userOrganization`, obligatory); an organization has **many users** (invitations). The projects of an organization share their resources
(persons, equipment): `project_table.rowParentGUID` = the organization of the project's owner, set by the database on insert and **never changed**. A user in several organizations may come later: nothing in
the capacity check reads the organization of a *user* - the scope is always the organization of the *project*.

* **Creation of a user**: `organization_ensure_user(email, auth uid, first, last)` (SQL, one transaction) makes the organization (the one he owns, else the one he was invited to, else a new one) and the
  userTable row. The client calls it at sign-in (`kit8/auth/userTableLogin.ts` → `userState.userOrganization.rowGUID`); it can no longer insert into `userTable`.
* **Admin** = the creator (`organizationTable.rowJSON.createdByUser`). Only the admin changes the organization and invites: `organization_invite_user(email)`, `organization_revoke_invitation`.
  An existing user accepts with `organization_accept_invitation` (his old projects keep their organization). A user cannot change his own `userOrganization`.
* **Setting** `resourceCapacityStrongMode` (Organization edit → Resource capacity): `capacityModeOff | capacityModeWarn | capacityModeBlock`, see `kit8/pm/view/task/plan/README.md`.
* SQL: PART 20 of `kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql` (mirrored in `start2_sql_code.sql`; the delete is PART 1b of `delete_sql_structure.sql`). Old data: every user without an organization gets the one he owns
  (rule "1 user owns 1 organization") or a new one; every project gets the organization of its owner; a project of an owner with no userTable row stays empty and is reported.
* Not built yet: a screen for the invitations (the SQL and its tests are there).

## Default project settings (`rowJSON.defaultProjectSettings`)

* **Organization edit** has two top tabs: **Main** (the old form) and **Projects** → sub tab **Settings** (`OrganizationProjectSettings.tsx`, loaded lazily): the same switches and tabs as the Project settings window
  (Main = working days / plan units / date format, Budgets, Vendor, Product, Subprojects - the very same components) edit the defaults of a NEW project. Save / Cancel are on both tabs; a user who is not the administrator sees them read-only.
* **Project settings window → three dots menu → "Save settings to organization"** (`PMRecentProjectsToolbar`, testID `pm-project-settings-save-to-organization`): the values IN the window (also unsaved edits) become `defaultProjectSettings`
  (`useMyOrganization().saveDefaultProjectSettings`: reads the newest `rowJSON`, merges ONE key, updates; no row back = not the administrator -> told in a snackbar).
* **A new project** (`openNew` of the same toolbar) starts from them: `newProjectPatchFrom(defaults)`. An organization that never saved them changes nothing. A center (cost / revenue / profit / investment) the defaults leave empty is
  not overwritten (the first fitting business unit stays), the "business units required" flag of a new project stays on. Existing projects, templates and imports are not touched.
* What is a setting: `defaultProjectSettings.ts` (`defaultProjectSettingsOf`): Main + `budgetsValuesOf` + `vendorValuesOf` + `customerValuesOf` + `productValuesOf` (the Product catalog of the organization reads its ItemNumber / SearchName switches from here: `kit8/catalog/product/useProductFields.ts`) + `subprojectValuesOf`. NOT: name, dates, project manager, partners, kanban, the row command modes.
* No SQL: it is a key of `organizationTable.rowJSON` (the update policy lets only the creator write). Tests: `__tests__/catalog/organization/defaultProjectSettings.test.ts`, `organizationProjectsTab.test.tsx`, `__tests__/pm/ui/projectSettingsOrganizationDefaults.test.tsx`.
