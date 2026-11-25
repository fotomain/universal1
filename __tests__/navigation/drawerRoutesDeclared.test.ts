// Every screen the hamburger menu opens must be declared as a <Drawer.Screen> in app/_layout.tsx: a route file that is not declared opened Home instead of its screen
// (Catalogs -> Projects, 2026-11-25). Also: no route file the catalogs open (app/catalog/**) may be left undeclared.
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const layout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8');
const drawer = fs.readFileSync(path.join(root, 'kit8/ui/components/CustomDrawerContent.tsx'), 'utf8');
const declared = new Set([...layout.matchAll(/<Drawer\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]).concat([...layout.matchAll(/name="([^"]+)"\s*\n\s*options/g)].map((m) => m[1])));
const isDeclared = (route: string) => declared.has(route) || declared.has(`${route}/index`);

function routeFiles(dir: string, base = ''): string[] {
  return fs.readdirSync(path.join(dir, base), { withFileTypes: true }).flatMap((e) => {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) return routeFiles(dir, rel);
    return /\.(tsx|ts)$/.test(e.name) && !/^[_+]/.test(e.name) ? [rel.replace(/\.(web|native)?\.?(tsx|ts)$/, '').replace(/\.(tsx|ts)$/, '')] : [];
  });
}

describe('drawer routes are declared', () => {
  test('every route of the hamburger menu has a Drawer.Screen', () => {
    const routes = [...drawer.matchAll(/route:\s*'([^']+)'/g)].map((m) => m[1]).filter((r) => r && !r.startsWith('/'));
    const missing = [...new Set(routes)].filter((r) => !isDeclared(r) && r !== 'home');
    expect(missing).toEqual([]);
  });

  test('every route file under app/catalog is declared', () => {
    const files = routeFiles(path.join(root, 'app'), 'catalog');
    const missing = files.filter((f) => !isDeclared(`catalog/${f.replace(/^catalog\//, '')}`) && !isDeclared(f));
    expect(missing).toEqual([]);
  });
});
