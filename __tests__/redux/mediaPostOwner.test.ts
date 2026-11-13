// The owner of a media post that is not a project post (kit8/redux/mediaPostOwner.ts) and the slice field behind it.
import reducer, { setActiveUser, clearActiveUser } from '../../kit8/redux/activeUserSlice';
import { mediaPostOwnerGUID } from '../../kit8/redux/mediaPostOwner';

const FULL = '0f8fad5b-d9cb-469f-a165-70867728950e';
const AUTH = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const user = { activeUserGUID: FULL.slice(0, 32), activeUserEmail: 'bob@example.com', activeUserFirstName: 'Bob', activeUserLastName: '' };

describe('mediaPostOwnerGUID', () => {
  it('is the GUID the database answered at login, before the GUID of the login step', () => {
    expect(mediaPostOwnerGUID({ activeUserState: { databaseUserGUID: AUTH, userGUID: 'old-short-row-guid', activeUserGUID: 'old-short-row-guid' } })).toBe(AUTH);
  });
  it('falls back to the full user GUID, then to the cut one', () => {
    expect(mediaPostOwnerGUID({ activeUserState: { databaseUserGUID: '', userGUID: FULL, activeUserGUID: FULL.slice(0, 32) } })).toBe(FULL);
    expect(mediaPostOwnerGUID({ activeUserState: { activeUserGUID: FULL.slice(0, 32) } })).toBe(FULL.slice(0, 32)); // state kept by an older app version
    expect(mediaPostOwnerGUID({})).toBe('');
  });
});

describe('activeUserState.databaseUserGUID', () => {
  it('is set only by the login step and kept by the other callers of the same user', () => {
    let s = reducer(undefined, setActiveUser({ ...user, userGUID: FULL, databaseUserGUID: AUTH }));
    expect(s.databaseUserGUID).toBe(AUTH);
    s = reducer(s, setActiveUser({ ...user })); // a caller that knows only the auth user
    expect(s.databaseUserGUID).toBe(AUTH);
    expect(mediaPostOwnerGUID({ activeUserState: s })).toBe(AUTH);
  });
  it('is forgotten for another user and at sign out', () => {
    let s = reducer(undefined, setActiveUser({ ...user, userGUID: FULL, databaseUserGUID: AUTH }));
    expect(reducer(s, setActiveUser({ ...user, activeUserEmail: 'ann@example.com' })).databaseUserGUID).toBe('');
    expect(reducer(s, clearActiveUser()).databaseUserGUID).toBe('');
  });
});
