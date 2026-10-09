// TREE.PLUGIN - generators for the 200k demo (FolderTree200k) and for tests: a big, deterministic folder tree and
// products spread over it.
import type { FolderTreeNode } from './folderTreeModel';

/** small deterministic random generator (the same tree on every run) */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEPARTMENTS = ['Electronics', 'Fashion', 'Food', 'Home', 'Garden', 'Sport', 'Toys', 'Books', 'Beauty', 'Health', 'Auto', 'Office', 'Pets', 'Tools', 'Music', 'Games', 'Travel', 'Baby', 'Art', 'Industrial'];
const WORDS = ['Premium', 'Basic', 'Outdoor', 'Indoor', 'Mini', 'Maxi', 'Smart', 'Classic', 'Eco', 'Pro', 'Kids', 'Urban', 'Retro', 'Nordic', 'Compact', 'Deluxe', 'Fresh', 'Organic', 'Digital', 'Manual'];
const NOUNS = ['Devices', 'Parts', 'Sets', 'Kits', 'Series', 'Lines', 'Packs', 'Bundles', 'Range', 'Collection', 'Group', 'Class', 'Family', 'Tier', 'Edition'];

/**
 * `count` folders: 20 departments, then every folder gets a random earlier folder as parent (never deeper than `maxDepth`),
 * so the tree is wide at the top and has long branches. Orders are 1000, 2000 ... in list order.
 */
export function generateFolderNodes(count: number, maxDepth = 8, seed = 7): FolderTreeNode[] {
  const rnd = mulberry32(seed);
  const nodes: FolderTreeNode[] = new Array(count);
  const depth = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    let parentId: string | null = null;
    if (i >= DEPARTMENTS.length) {
      let p = Math.floor(rnd() * i);
      while (depth[p] >= maxDepth - 1) p = Math.floor(rnd() * i);
      parentId = `f${p}`;
      depth[i] = depth[p] + 1;
    }
    const title = i < DEPARTMENTS.length ? DEPARTMENTS[i] : `${WORDS[Math.floor(rnd() * WORDS.length)]} ${NOUNS[Math.floor(rnd() * NOUNS.length)]} ${i}`;
    nodes[i] = { id: `f${i}`, parentId, title, order: (i + 1) * 1000 };
  }
  return nodes;
}

export interface DemoProduct { id: string; title: string }

/** `count` products with a title; `folderOf[i]` = the folder id of product i (random folder, 5% without a folder) */
export function generateProducts(count: number, folderCount: number, seed = 11): { products: DemoProduct[]; folderOf: (string | null)[] } {
  const rnd = mulberry32(seed);
  const products: DemoProduct[] = new Array(count);
  const folderOf: (string | null)[] = new Array(count);
  for (let i = 0; i < count; i++) {
    products[i] = { id: `p${i}`, title: `${WORDS[Math.floor(rnd() * WORDS.length)]} product ${i}` };
    folderOf[i] = rnd() < 0.05 || folderCount === 0 ? null : `f${Math.floor(rnd() * folderCount)}`;
  }
  return { products, folderOf };
}
