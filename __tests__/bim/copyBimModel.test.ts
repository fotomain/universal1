// copyBimModel: the order (begin -> files -> commit) and the failure handling, with a fake cloud (no network).
import { BIM_COPY_PARALLEL, copyBimModel, type BimCopyCloud } from '../../kit8/pm/bim/copy/copyBimModel';

const files = [0, 1, 2, 3, 4, 5].map((i) => ({ from: `src/m/h${i}.bimc`, to: `dst/n/h${i}.bimc` }));
const begun = { modelGUID: 'model-new', revision: 1, storagePrefix: 'dst/n', files, counts: { storeys: 4, chunks: 6, elements: 215, properties: 215 } };

function fakeCloud(over: Partial<BimCopyCloud> = {}) {
  const log: string[] = [];
  let running = 0;
  let maxRunning = 0;
  const cloud: BimCopyCloud = {
    copyBegin: async (s, t, m) => {
      log.push(`begin ${s} ${t} ${Object.keys(m).length}`);
      return begun;
    },
    copyFile: async (from, to) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 1));
      running--;
      log.push(`copy ${from}>${to}`);
    },
    commit: async (m, counts) => {
      log.push(`commit ${m} ${counts.elements}`);
      return { modelGUID: m, revision: 1, counts: { elements: 215, chunks: 6 } };
    },
    fail: async (m, text, paths) => {
      log.push(`fail ${m} ${text} ${paths.length}`);
    },
    ...over,
  };
  return { cloud, log, max: () => maxRunning };
}

describe('copyBimModel', () => {
  it('begins, copies every file (a few at a time), then commits', async () => {
    const { cloud, log, max } = fakeCloud();
    const r = await copyBimModel(cloud, 'S', 'T', { a: 'b', c: 'd' });
    expect(log[0]).toBe('begin S T 2');
    expect(log.filter((l) => l.startsWith('copy '))).toHaveLength(6);
    expect(log[log.length - 1]).toBe('commit model-new 215');
    expect(max()).toBeLessThanOrEqual(BIM_COPY_PARALLEL);
    expect(r).toEqual({ copied: true, elements: 215, chunks: 6, modelGUID: 'model-new' });
  });

  it('a source without a model copies nothing', async () => {
    const { cloud, log } = fakeCloud({ copyBegin: async () => null });
    expect(await copyBimModel(cloud, 'S', 'T', {})).toEqual({ copied: false, elements: 0, chunks: 0 });
    expect(log).toEqual([]);
  });

  it('a failing file makes bim_import_fail with ALL destination paths and rethrows; no commit', async () => {
    let n = 0;
    const { cloud, log } = fakeCloud({
      copyFile: async () => {
        if (++n === 3) throw new Error('The resource already exists');
      },
    });
    await expect(copyBimModel(cloud, 'S', 'T', {})).rejects.toThrow('already exists');
    expect(log.some((l) => l.startsWith('commit'))).toBe(false);
    expect(log[log.length - 1]).toBe('fail model-new The resource already exists 6');
  });

  it('a failing commit is cleaned up too', async () => {
    const { cloud, log } = fakeCloud({
      commit: async () => {
        throw new Error('rows are not the rows announced');
      },
    });
    await expect(copyBimModel(cloud, 'S', 'T', {})).rejects.toThrow('announced');
    expect(log[log.length - 1]).toMatch(/^fail model-new rows are not the rows announced 6$/);
  });

  it('the error of the copy is shown even when the cleanup fails as well', async () => {
    const { cloud } = fakeCloud({
      copyFile: async () => {
        throw new Error('first error');
      },
      fail: async () => {
        throw new Error('second error');
      },
    });
    await expect(copyBimModel(cloud, 'S', 'T', {})).rejects.toThrow('first error');
  });
});
