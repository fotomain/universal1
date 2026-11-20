# kit8/ui/organization/assistant - the Create Organization Assistant (built 2026-11-20)

React Native Paper screens, the look of the Create New Project Assistant (it reuses its navigation bar, expert card and fields). Route: `app/catalog/organization/assistant` (`/catalog/organization/assistant`); the **Add** button of the Organizations list (`kit8/catalog/organization/OrganizationList.tsx`) opens it. An EXISTING organization is still edited in Organization edit.

## The questions (`organizationAssistantModel.ts`, pure, tested)
**The organization** (name, legal name, country, contact e-mail / phone / website, notes) -> **Legal data** (registration no, VAT no, address, IBAN) -> **Currencies** (budget / accounting / contracts of a NEW project + the obligatory **consolidation currency**) -> **Resource calendars** (what a Post does with a resource booked above its calendar: Off | Warn | Block) -> **Review**. An error blocks Next (no name, a VAT number that is not `LV12345678901`, a currency that is not 3 letters ...); a warning only advises (a name the user already sees, an odd IBAN).

## The end (`CreateOrganizationAssistant.tsx`, `saveOrganization.ts`)
1. **Create organization** inserts ONE row of `organizationTable` straight through Supabase (the assistant must know whether it was made). `createdByUser` = the e-mail of the user: the database makes him the ACTIVE ADMINISTRATOR member (SQL PART 45 trigger). The row is owned by his e-mail; a user who owns one already (unique index "one organization per owner e-mail") gets the row as a row of the catalog owner (`rowOwnerGUID = 'organizationCatalog'`). Then `organization_switch` makes it the user's ACTIVE organization.
2. **Continue to create Project?** Yes = `/pm/project/assistant?mode=assistant&target=new` (the Create New Project Assistant, the project is made in the new organization).
3. No = **Set up the default settings for projects?** Yes = `/pm/project/assistant?mode=assistant&target=organization` (the same assistant WITHOUT the name and the dates: `ASSISTANT_ORGANIZATION_TARGET`; its end is "Save as default settings" = `defaultProjectSettings` of the organization, no project is made). No = the default project settings (the currencies of this assistant over the built-in default of every setting) are STORED in the organization (`saveOrganizationDefaultSettings`) and the user is back in the list.

## Not built
The unfinished run is not kept on the device (it is short); the texts go through `pmT` (English only); the organization's other tabs (Time sheet, Files, Chat, System, Consolidation rate type / VAT switches) are not asked - Organization edit has them. A person who is only invited is not offered an organization. An application administrator (`permissionApplicationAdmin`) can make organizations like any user.

Tests: `__tests__/ui/organization/assistant` (model, save, the screen), `__tests__/ui/project/assistant/organizationTarget.test.ts` and the last block of `createNewProjectAssistant.test.tsx` (the project assistant for the defaults).
