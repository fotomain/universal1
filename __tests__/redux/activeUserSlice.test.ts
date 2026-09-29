// isLoggedIn = activeUserEmail !== "user@example.com"
import reducer, {
  GUEST_USER_EMAIL,
  clearActiveUser,
  selectIsLoggedIn,
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
