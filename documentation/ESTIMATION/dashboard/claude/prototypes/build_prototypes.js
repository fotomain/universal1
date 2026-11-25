// Bundles src/index.tsx for the web with the project's own Metro setup (react-native-paper + react-native-web), no new packages.
// usage (from the repo root):  node documentation/ESTIMATION/dashboard/claude/prototypes/build_prototypes.js <outDir>
const path = require('path');
const fs = require('fs');
const Metro = require('metro');
const root = path.resolve(__dirname, '../../../../..');
process.chdir(root);
const out = path.resolve(process.argv[2] || path.join(__dirname, 'dist'));
fs.mkdirSync(out, { recursive: true });

(async () => {
  const config = await Metro.loadConfig({ config: path.join(root, 'metro.config.js'), cwd: root });
  // expo-font's server context asks for node:async_hooks (a server-only file the browser build never calls): answer it with an empty module
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, name, platform) => {
    if (name.startsWith('node:')) return { type: 'empty' };
    // the Expo CLI maps react-native to react-native-web for the web platform; a bare Metro build has to do it itself
    const target = name === 'react-native' ? 'react-native-web' : name;
    const res = (upstream ?? context.resolveRequest)({ ...context, preferNativePlatform: false }, target, platform);
    if (process.env.DEBUG_RN && res.filePath && /node_modules\/react-native\//.test(res.filePath)) console.log('NATIVE RN:', name, 'from', context.originModulePath.replace(root, ''));
    return res;
  };
  config.resolver.preferNativePlatform = false; // a web build must not pick the *.native.js twins
  config.resolver.resolverMainFields = ['browser', 'module', 'main'];
  const entry = path.relative(root, path.join(__dirname, 'src/index.tsx'));
  await Metro.runBuild(config, { entry, platform: 'web', dev: false, minify: false, out: path.join(out, 'bundle.js'), sourceMap: false });
  fs.writeFileSync(
    path.join(out, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1440"><style>html,body,#root{margin:0;height:100%;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}</style></head><body><div id="root"></div><script src="bundle.js"></script></body></html>'
  );
  console.log('built ->', out);
})().catch((e) => { console.error(e); process.exit(1); });
