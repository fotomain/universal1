# Organization members (SQL PART 45)

`organizationMemberTable` - who is a member of which organization. A user may work in **many** organizations; `userTable.rowJSON.userOrganization` stays the **ACTIVE** one (a new project belongs to it).
Design: `documentation/PERMISSIONS_WBS.html` section 4.

| column | value |
|---|---|
| `rowOwnerGUID` | the organization |
| `rowParentGUID` | the user (`userTable.rowGUID`); `'empty'` while an invited user has not logged in yet |
| `rowJSON.userEmailForInvitation` | lower case e-mail (unique per organization) |
| `rowJSON.organizationAdministrator` | boolean; `true` for the creator of the organization (automatically) |
| `rowJSON.memberStatus` | `invited` (no user yet) or `active` (a user is linked) - set by the database |
| `rowJSON.autoCreatePerson` | default `true`: a person is made at the user's first login |
| `invitedAt` · `invitedBy` · `registeredAt` · `inviteSentAt` · `inviteError` | set by the database / the invitation function |

## Rules (database: trigger `organization_member_guard`, RLS)

* The **administrator** adds a row (insert; or `organization_invite_user(email)`): an e-mail of a **registered** user is **active** at once (his active organization does not change), any other is **invited**
  until his first login (`organization_ensure_user` links the row: `rowParentGUID`, `active`, `registeredAt`). A new user with an invitation joins THAT organization instead of getting an own one.
* Only `organizationAdministrator` and `autoCreatePerson` of a row are edited; status, user, e-mail and dates are not (the client's values are ignored / refused).
* **Nobody deletes himself** - another administrator does. The organization **always keeps an active administrator** (no delete, no unmark of the last one). A member who **owns projects** of the
  organization cannot be removed. Deleting the organization removes its members.
* A member who is no administrator reads his own row only. `organization_is_admin(org)` = an active administrator row with the e-mail of the caller (an organization with no rows: its creator).
* **Many organizations**: `organization_my_memberships()` lists them, `organization_switch(org)` changes the active one (only to an organization he is an active member of),
  `organization_accept_invitation(member)` = become active + switch. The **Organization filter** in the project bar (`switch/OrganizationFilter.tsx`, shown for 2+ organizations) is that switch;
  the Project dashboard offers only the projects of the active organization (`projectsOfOrganization` in `crud/project/projectQueries.ts`).
* **Person**: independent of the user. Made at the first login when `autoCreatePerson`; later by the user (`person_create_own`, the profile block `kit8/catalog/person/MyPersonSection.tsx`) or by the
  administrator (`organization_member_create_person`, row menu "Create person"). Never duplicated (found by e-mail).
* `organization_invite_user / _revoke_invitation / _ensure_user / _accept_invitation / organization_is_admin` of PART 20 are **replaced** by the copies of PART 45. `organizationInvitationTable`
  stays (no new rows; its pending rows were migrated by `organization_member_backfill()`, which also gives every old organization its administrator and every user a member row).

## The screen and the invitation e-mail

* `OrganizationMembersCRUD.tsx` (Catalogs -> Organization members, route `/catalog/organization/members`): the **Invite** row (administrator only), a `ReusableTable` (administrator and "Person at first login"
  switches editable by the administrator), row menu **Create person** and **Send invitation again**. A member who is no administrator sees his own row, read only.
* The e-mail is sent by the Supabase **Edge Function `organization-invite`** (`supabase/functions/organization-invite`): it checks that the caller is an administrator of the organization of the row,
  calls `auth.admin.inviteUserByEmail` with the service role key (a secret of the function, never in the app) and writes `inviteSentAt` / `inviteError`. Logic: `handler.ts` (tested), wiring: `index.ts` (Deno).
  Deploy it yourself:

```bash
supabase functions deploy organization-invite
```

```bash
supabase secrets set INVITE_REDIRECT_URL=https://your-app-url
```

  Also set a custom SMTP sender in Supabase (Authentication -> Emails) - the built-in mail is limited to a few e-mails an hour - and add the redirect URL to Authentication -> URL configuration.
  Without the function the member row is still saved and the screen shows the error; the invited person can sign up with that e-mail anyway.

## Tests

`kit8/docker/tests/48_organization_members.sql` (67 checks; tests 10, 11, 12 updated), `__tests__/catalog/organization/organizationMember.test.ts`, `organizationMembersCrud.test.tsx`,
`organizationSwitch.test.tsx`, `organizationInviteFunction.test.ts`, `__tests__/catalog/person/myPersonSection.test.tsx`.
