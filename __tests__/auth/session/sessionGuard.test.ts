import { dropSavedUserWhenSessionGone, sessionIsReallyGone } from '../../../kit8/auth/session/sessionGuard';

const client = (result: any) => ({ auth: { getSession: jest.fn(async () => { if (result instanceof Error) throw result; return result; }) } }) as any;

describe('sessionIsReallyGone', () => {
  it('is true only when Supabase answered without a session and without an error', () => {
    expect(sessionIsReallyGone({ data: { session: null }, error: null })).toBe(true);
    expect(sessionIsReallyGone({ data: { session: { user: {} } }, error: null })).toBe(false);
    expect(sessionIsReallyGone({ data: { session: null }, error: new Error('Failed to fetch') })).toBe(false);
    expect(sessionIsReallyGone(undefined)).toBe(false);
  });
});

describe('dropSavedUserWhenSessionGone', () => {
  it('drops the saved user after INITIAL_SESSION with no session when Supabase confirms it', async () => {
    const onGone = jest.fn();
    const done = await dropSavedUserWhenSessionGone(client({ data: { session: null }, error: null }), 'INITIAL_SESSION', null, () => true, onGone);
    expect(done).toBe(true);
    expect(onGone).toHaveBeenCalledTimes(1);
  });
  it('drops it after SIGNED_OUT too', async () => {
    const onGone = jest.fn();
    expect(await dropSavedUserWhenSessionGone(client({ data: { session: null }, error: null }), 'SIGNED_OUT', null, () => true, onGone)).toBe(true);
  });
  it('keeps the user when the answer is an error (offline, 522) or the call throws', async () => {
    const onGone = jest.fn();
    expect(await dropSavedUserWhenSessionGone(client({ data: { session: null }, error: new Error('522') }), 'INITIAL_SESSION', null, () => true, onGone)).toBe(false);
    expect(await dropSavedUserWhenSessionGone(client(new Error('network')), 'INITIAL_SESSION', null, () => true, onGone)).toBe(false);
    expect(onGone).not.toHaveBeenCalled();
  });
  it('keeps the user when there is a session, for other events, for a guest, or when he signed in meanwhile', async () => {
    const onGone = jest.fn();
    const gone = client({ data: { session: null }, error: null });
    expect(await dropSavedUserWhenSessionGone(gone, 'INITIAL_SESSION', { user: {} }, () => true, onGone)).toBe(false);
    expect(await dropSavedUserWhenSessionGone(gone, 'TOKEN_REFRESHED', null, () => true, onGone)).toBe(false);
    expect(await dropSavedUserWhenSessionGone(gone, 'INITIAL_SESSION', null, () => false, onGone)).toBe(false);
    const flips = [true, false];
    expect(await dropSavedUserWhenSessionGone(gone, 'INITIAL_SESSION', null, () => flips.shift() ?? false, onGone)).toBe(false);
    expect(onGone).not.toHaveBeenCalled();
  });
});
