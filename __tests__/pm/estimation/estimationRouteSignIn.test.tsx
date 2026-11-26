/** @jest-environment jsdom */
// The route /pm/project/estimation/dashboard is for SIGNED-IN users only: a guest gets the Sign in card (and comes back with ?projectGUID), a signed-in user the dashboard
import React from 'react';
import { cleanup, flush, press, q, render, text } from '../../media/mediaUiTestKit';

let mockState: any;
jest.mock('react-redux', () => ({ useDispatch: () => jest.fn(), useSelector: (fn: any) => fn(mockState) }));
jest.mock('../../../kit8/pm/estimation/EstimationDashboard', () => ({ __esModule: true, default: () => require('react').createElement('div', { 'data-testid': 'estimation-dashboard' }, 'dashboard') }));

import EstimationDashboardScreen from '../../../app/pm/project/estimation/dashboard/index';

const push = jest.fn();
beforeEach(() => { (globalThis as any).__push = push; });
afterEach(() => { cleanup(); jest.clearAllMocks(); });

it('a guest does not get the dashboard: he is offered to sign in and comes back to the route', async () => {
  mockState = { activeUserState: { activeUserEmail: 'user@example.com' } };
  render(<EstimationDashboardScreen />);
  await flush();
  expect(q('estimation-dashboard')).toBeNull();
  expect(text('recording-signin-title')).toBe('Sign in to open the Estimation dashboard');
  press('recording-signin-button');
  expect(push).toHaveBeenLastCalledWith({ pathname: '/user/signin', params: { returnTo: '/pm/project/estimation/dashboard' } });
});

it('a signed-in user gets the dashboard', async () => {
  mockState = { activeUserState: { activeUserEmail: 'foto888999@gmail.com' } };
  render(<EstimationDashboardScreen />);
  await flush();
  expect(q('estimation-dashboard')).not.toBeNull();
  expect(q('recording-signin-gate')).toBeNull();
});
