/** app.config.js: the variant appPM80 (Project Budget Management) and its OWN EAS project. */
const CLOTHES1_PROJECT_ID = 'bcc76802-860a-4f85-9d51-723119055d94';

function configOf(appName?: string) {
  const saved = process.env.APP_NAME;
  if (appName === undefined) delete process.env.APP_NAME;
  else process.env.APP_NAME = appName;
  jest.resetModules();
  const cfg = require('../../../app.config.js').expo;
  if (saved === undefined) delete process.env.APP_NAME;
  else process.env.APP_NAME = saved;
  return cfg;
}

describe('app.config.js appPM80', () => {
  const cfg = configOf('appPM80');

  it('has the name, the slug and the bundle ids', () => {
    expect(cfg.name).toBe('Project Budget Management');
    expect(cfg.slug).toBe('project-budget-management');
    expect(cfg.ios.bundleIdentifier).toBe('com.projectbudgetmanagement');
    expect(cfg.android.package).toBe('com.projectbudgetmanagement');
    expect(cfg.extra.configurationName).toBe('appPM80');
  });

  it('has an EAS project of its own, never the one of the Clothes1 site', () => {
    expect(cfg.extra.eas.projectId).toMatch(/^[0-9a-f-]{36}$/);
    expect(cfg.extra.eas.projectId).not.toBe(CLOTHES1_PROJECT_ID);
  });

  it('leaves the default app on its old project', () => {
    const def = configOf(undefined);
    expect(def.slug).toBe('my-clothes1-app');
    expect(def.extra.eas.projectId).toBe(CLOTHES1_PROJECT_ID);
  });
});
