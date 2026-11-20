// PMProjectBimTab - the "BIM" tab of the Project settings window (TabBIM, after TabKanban). The switch projectIsBIMBased = project_table.rowJSON.projectIsBIMBased is ALWAYS SWITCHABLE (owner, 2026-11-20):
// on = the BIM button of the view switch is shown for the project (the BIM import sets it too); off = the button is hidden (the model, if any, stays until Remove BIM data). Saved with the window's Save.
//   facts of the last import (bim_model_manifest): file, schema, unit scale, converter, revision, date, storeys, elements, tasks, chunks, hash
//   Import BIM (IFC)  opens the importer (route /pm/bim/import) for THIS project - an import into a BIM project replaces its tasks (the importer asks first)
//   Remove BIM data   deletes the model, the chunk files and the mark; the tasks stay (project manager / administrator)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import { useSupabase } from '../../../../providers/WithSupabase';
import { pmT } from '../../../i18n/pmT';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import ButtonTextApp from '../../../../ui/components/common/ButtonTextApp';
import { approvePM } from '../../../inner/PMApproveYesNoCancelModalWindow';
import { pmKeys } from '../../../crud/shared/queryShared';
import { createBimCloud } from '../../../bim/cloud/bimCloud';
import { bimModelFacts, projectIsBimBased, type BimModelInfo } from '../../../bim/model/bimModel';
import { usePMStore } from '../../../store/store_pm';

export default function PMProjectBimTab({ projectGUID, rowJSON, ownerGUID, values, onChange, onOpenImporter }: { projectGUID?: string; rowJSON?: Record<string, any>; ownerGUID?: string; /** the host closes its window and opens the importer (without it the tab navigates itself) */ onOpenImporter?: () => void; values?: { projectIsBIMBased?: boolean }; onChange?: (patch: { projectIsBIMBased?: boolean }) => void }) {
  const { themeColors: c } = useDesignSystem();
  const { supabase } = useSupabase();
  const router = useRouter();
  const qc = useQueryClient();
  const cloud = useMemo(() => createBimCloud(supabase), [supabase]);
  const bimBased = projectIsBimBased(rowJSON);
  const switchOn = values ? values.projectIsBIMBased === true : bimBased;
  const [facts, setFacts] = useState<BimModelInfo | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const readonly = usePMStore((s) => !!(projectGUID && s.projectsById[projectGUID]?.rowJSON?.projectIsReadonly === true));

  useEffect(() => {
    if (!projectGUID || !bimBased) return setFacts(null);
    let off = false;
    cloud.manifest(projectGUID).then((m) => !off && setFacts(m?.model ?? null)).catch((e) => !off && setMessage((e as Error).message));
    return () => {
      off = true;
    };
  }, [projectGUID, bimBased, cloud]);

  const remove = useCallback(async () => {
    if (!projectGUID) return;
    const ok = await approvePM({
      title: pmT('Remove the BIM data?'),
      message: pmT('The 3D model, its element links and its chunk files are DELETED. The stages and tasks stay. This cannot be undone (import the IFC again to get the model back).'),
      yesLabel: pmT('Remove BIM data'),
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const paths = await cloud.deleteModel(projectGUID);
      await cloud.removeFiles(paths);
      await qc.invalidateQueries({ queryKey: pmKeys.projects(ownerGUID) });
      await qc.invalidateQueries({ queryKey: ['bim'] });
      setMessage(pmT('The BIM data of the project was removed.'));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [cloud, ownerGUID, projectGUID, qc]);

  return (
    <View testID="pm-project-tab-bim-content" style={{ gap: 12 }}>
      <SwitchApp testID="pm-project-bim-based" label={pmT('Project is BIM based (projectIsBIMBased)')} value={switchOn} disabled={readonly || !onChange} onValueChange={(v: boolean) => onChange?.({ projectIsBIMBased: v })} />
      <Text style={{ color: c.text, opacity: 0.7, fontSize: 13 }}>{pmT('On: the BIM button is shown for this project. The BIM import turns it on. Off: the button is hidden; an imported model stays until you press Remove BIM data. Save the window to apply.')}</Text>
      {bimBased && facts ? (
        <View testID="pm-project-bim-facts" style={{ gap: 2 }}>
          {bimModelFacts(facts).map((f) => (
            <Text key={f.label} style={{ color: c.text, fontSize: 13 }}>
              <Text style={{ opacity: 0.6 }}>{pmT(f.label)}: </Text>
              {f.value}
            </Text>
          ))}
        </View>
      ) : null}
      {projectGUID ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <ButtonTextApp testID="pm-project-bim-import" title={pmT(bimBased ? 'Import again (replaces the tasks)…' : 'Import BIM (IFC)…')} disabled={busy || readonly} onPress={() => (onOpenImporter ? onOpenImporter() : router.push(`/pm/bim/import?projectGUID=${projectGUID}` as any))} />
          {bimBased ? <ButtonTextApp testID="pm-project-bim-remove" title={pmT('Remove BIM data')} disabled={busy || readonly} onPress={remove} /> : null}
        </View>
      ) : null}
      {message ? <Text testID="pm-project-bim-message" style={{ color: c.text, fontSize: 13 }}>{message}</Text> : null}
    </View>
  );
}
