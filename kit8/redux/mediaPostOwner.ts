// Who is the owner (rowOwnerGUID) of a media post that is not a post of a project.
// The database accepts and shows such a post only when its owner is the FULL user GUID of the signed-in user
// (start2 PART 49, policies mediaPost_insert / _select: "rowOwnerGUID" = app_user_guid()). activeUserGUID is that GUID
// CUT to 32 characters (older tables are keyed by it): a post written with it is refused -
// "you have no permission", also for an administrator. So: the full userGUID, the cut one only before the login gave it.
// Pure: no redux import.
export function mediaPostOwnerGUID(state: any): string {
  const user = state?.activeUserState;
  return String(user?.userGUID || user?.activeUserGUID || '');
}
