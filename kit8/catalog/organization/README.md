# Organization (`kit8/catalog/organization`)

A user belongs to **one organization** (`userTable.rowJSON.userOrganization`, obligatory); an organization has **many users** (invitations). The projects of an organization share their resources
(persons, equipment): `project_table.rowParentGUID` = the organization of the project's owner, set by the database on insert and **never changed**. A user in several organizations may come later: nothing in
the capacity check reads the organization of a *user* - the scope is always the organization of the *project*.

* **Creation of a user**: `organization_ensure_user(email, auth uid, first, last)` (SQL, one transaction) makes the organization (the one he owns, else the one he was invited to, else a new one) and the
  userTable row. The client calls it at sign-in (`kit8/auth/userTableLogin.ts` → `userState.userOrganization.rowGUID`); it can no longer insert into `userTable`.
* **Admin** = the creator (`organizationTable.rowJSON.createdByUser`). Only the admin changes the organization and invites: `organization_invite_user(email)`, `organization_revoke_invitation`.
  An existing user accepts with `organization_accept_invitation` (his old projects keep their organization). A user cannot change his own `userOrganization`.
* **Setting** `resourceCapacityStrongMode` (Organization edit → Resource capacity): `capacityModeOff | capacityModeWarn | capacityModeBlock`, see `kit8/pm/view/task/plan/README.md`.
* SQL: PART 20 of `kit8/sql/start/start1_sql_structure.sql` (mirrored in `start2_sql_code.sql`; the delete is PART 1b of `delete_sql_structure.sql`). Old data: every user without an organization gets the one he owns
  (rule "1 user owns 1 organization") or a new one; every project gets the organization of its owner; a project of an owner with no userTable row stays empty and is reported.
* Not built yet: a screen for the invitations (the SQL and its tests are there).
