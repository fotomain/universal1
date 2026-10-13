// isLoggedIn = activeUserEmail !== "user@example.com"
import reducer, {
  GUEST_USER_EMAIL,
  clearActiveUser,
  selectIsLoggedIn,
  selectUserOrganizationGUID,
  setActiveUser,
} from '../../kit8/redux/activeUserSlice';

const real = { activeUserGUID: 'abc', activeUserEmail: 'jurij@test.com', activeUserFirstName: 'J', activeUserLastName: '' };

it('starts as the signed-out guest', () => {
  const s = reducer(undefined, { type: '@@init' });
  expect(s.activeUserEmail).toBe(GUEST_USER_EMAIL);
  expect(s.isLoggedIn).toBe(false);
  expect(selectIsLoggedIn({ activeUserState: s })).toBe(false);
});

it('setActiveUser with a real email -> logged in; clearActiveUser -> guest again', () => {
  const inS = reducer(undefined, setActiveUser(real));
  expect(inS.isLoggedIn).toBe(true);
  expect(inS.activeUserGUID).toHaveLength(32);
  expect(selectIsLoggedIn({ activeUserState: inS })).toBe(true);

  const outS = reducer(inS, clearActiveUser());
  expect(outS.activeUserEmail).toBe(GUEST_USER_EMAIL);
  expect(outS.isLoggedIn).toBe(false);
});

it('setActiveUser with the guest email -> not logged in', () => {
  expect(reducer(undefined, setActiveUser({ ...real, activeUserEmail: GUEST_USER_EMAIL })).isLoggedIn).toBe(false);
});

it('selector works on persisted state from before isLoggedIn existed', () => {
  expect(selectIsLoggedIn({ activeUserState: { activeUserEmail: 'a@b.com' } })).toBe(true);
  expect(selectIsLoggedIn({ activeUserState: { activeUserEmail: GUEST_USER_EMAIL } })).toBe(false);
  expect(selectIsLoggedIn({})).toBe(false);
});

// WP A4: userState.userOrganization comes only from the login step, like userGUID
it('userOrganization: set by the login step, kept by the other callers, dropped for another user', () => {
  const org = { rowGUID: 'org-1', title: 'Acme' };
  const first = reducer(undefined, setActiveUser({ ...real, userGUID: 'u-1', userOrganization: org }));
  expect(first.userOrganization).toEqual(org);
  expect(selectUserOrganizationGUID({ activeUserState: first })).toBe('org-1');

  // a caller that only knows the auth uid (sign-in screens) must not erase it for the same user
  expect(reducer(first, setActiveUser(real)).userOrganization).toEqual(org);
  // another user starts without one
  const other = reducer(first, setActiveUser({ ...real, activeUserEmail: 'other@test.com' }));
  expect(other.userOrganization).toEqual({ rowGUID: '', title: '' });
  expect(reducer(first, clearActiveUser()).userOrganization.rowGUID).toBe('');
});

it('selectUserOrganizationGUID works on state persisted before the organization existed', () => {
  expect(selectUserOrganizationGUID({ activeUserState: { activeUserEmail: 'a@b.com' } })).toBe('');
  expect(selectUserOrganizationGUID({})).toBe('');
});
