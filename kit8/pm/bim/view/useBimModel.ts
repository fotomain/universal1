// React side of the loader: the model of a project for the viewer.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabase } from '../../../providers/WithSupabase';
import { usePMStore } from '../../store/store_pm';
import type { BimcChunk } from '../bimc/bimcReader';
import { createBimCloud, type BimCloud } from '../cloud/bimCloud';
import { createBimChunkCache, createBimLocalDb } from '../local/bimLocalDb';
import type { BimChunkCache, BimLocalDb } from '../local/bimLocalTypes';
import type { BimElementRow, BimManifest } from '../model/bimModel';
import { chunkLoadOrder, loadBimModel, loadChunks } from './bimModelLoader';

export type BimModelState =
  | { state: 'loading'; text: string }
  | { state: 'none' }
  | { state: 'error'; text: string }
  | { state: 'ready'; manifest: BimManifest; elements: BimElementRow[]; chunks: Array<{ hash: string; chunk: BimcChunk }>; chunksTotal: number; source: 'cloud' | 'cache'; localKind: BimLocalDb['kind'] };

/** `onlyElementGUID` = the component screen: only the chunk file that holds this element is fetched (the elements and the manifest are the whole model's) */
export function useBimModel(projectGUID: string | null | undefined, priorityStoreyGUID?: string | null, onlyElementGUID?: string | null) {
  const { supabase } = useSupabase();
  const organizationGUID = usePMStore((s) => (projectGUID ? s.projectsById[projectGUID]?.rowParentGUID : undefined));
  const cloud: BimCloud = useMemo(() => createBimCloud(supabase), [supabase]);
  const [model, setModel] = useState<BimModelState>({ state: 'loading', text: 'Opening the BIM model' });
  const [reloadNonce, setReloadNonce] = useState(0);
  const handles = useRef<{ local: BimLocalDb; cache: BimChunkCache; org: string | null | undefined } | null>(null);
  const priority = useRef(priorityStoreyGUID);
  priority.current = priorityStoreyGUID;
  const only = useRef(onlyElementGUID);
  only.current = onlyElementGUID;

  useEffect(() => {
    if (!projectGUID) return;
    let cancelled = false;
    (async () => {
      try {
        setModel({ state: 'loading', text: 'Opening the BIM model' });
        if (!handles.current || handles.current.org !== organizationGUID) {
          handles.current = { local: await createBimLocalDb(organizationGUID), cache: await createBimChunkCache(organizationGUID), org: organizationGUID };
        }
        const { local, cache } = handles.current;
        const loaded = await loadBimModel({ cloud, local, chunkCache: cache }, projectGUID);
        if (cancelled) return;
        if (!loaded) return setModel({ state: 'none' });
        let infos = chunkLoadOrder(loaded.manifest, priority.current);
        if (only.current) {
          const hash = loaded.elements.find((e) => e.ifcGuid === only.current)?.chunkHash;
          if (!hash) return setModel({ state: 'error', text: 'This component is not in the model (a new import?).' });
          infos = infos.filter((i) => i.contentHash === hash);
        }
        const arrived: Array<{ hash: string; chunk: BimcChunk }> = [];
        setModel({ state: 'ready', manifest: loaded.manifest, elements: loaded.elements, chunks: [], chunksTotal: infos.length, source: loaded.source, localKind: local.kind });
        await loadChunks({ cloud, chunkCache: cache }, infos, (hash, chunk) => {
          if (cancelled) return;
          arrived.push({ hash, chunk });
          setModel({ state: 'ready', manifest: loaded.manifest, elements: loaded.elements, chunks: [...arrived], chunksTotal: infos.length, source: loaded.source, localKind: local.kind });
        }, 3, !only.current);
      } catch (e) {
        if (!cancelled) setModel({ state: 'error', text: (e as Error)?.message || 'The BIM model could not be opened.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectGUID, organizationGUID, cloud, reloadNonce, onlyElementGUID]);

  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);
  return { model, reload, cloud, local: handles.current?.local ?? null };
}
