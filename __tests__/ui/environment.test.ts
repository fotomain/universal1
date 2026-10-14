// environment: ENVIRONMENT_NAME of .env (through app.config.js extra) or EXPO_PUBLIC_ENVIRONMENT_NAME; only DEV_ENVIRONMENT is the developer environment.
const mockConstants: { expoConfig: any } = { expoConfig: { extra: {} } };
jest.mock('expo-constants', () => ({ __esModule: true, default: mockConstants }));
import { DEV_ENVIRONMENT, environmentName, isDevEnvironment } from '../../kit8/ui/environment';

afterEach(() => { mockConstants.expoConfig = { extra: {} }; delete process.env.EXPO_PUBLIC_ENVIRONMENT_NAME; });
it('is not a developer environment by default', () => {
  expect(environmentName()).toBe('');
  expect(isDevEnvironment()).toBe(false);
});
it('DEV_ENVIRONMENT from the app config (ENVIRONMENT_NAME of .env)', () => {
  mockConstants.expoConfig = { extra: { environmentName: ' DEV_ENVIRONMENT ' } };
  expect(environmentName()).toBe(DEV_ENVIRONMENT);
  expect(isDevEnvironment()).toBe(true);
});
it('the public variable works too; another name is not a developer environment', () => {
  process.env.EXPO_PUBLIC_ENVIRONMENT_NAME = 'DEV_ENVIRONMENT';
  expect(isDevEnvironment()).toBe(true);
  mockConstants.expoConfig = { extra: { environmentName: 'PRODUCTION' } };
  expect(isDevEnvironment()).toBe(false);
});
