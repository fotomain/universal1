// Row action buttons shared by the tree hover panel, the chart bar panel and the network node panel:
// edit · duplicate · copy task info · share · link · open task info · sql_for_delete.

import React, { useEffect, useRef, useState } from 'react';
import { PMPalette } from '../../view/theme';
import { PMCrud } from '../../crud/usePMCrud';
import type { PMShareResult } from '../../view/task/taskShare';
import { PMIconButton } from './PMIconButton';
import { pmT } from '../../i18n/pmT';

/** Short "done" feedback on the button itself (the panels have no room for a toast). */
function useFlash(ms = 1500) {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const flash = () => {
    setOn(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), ms);
  };
  return [on, flash] as const;
}

export default function PMRowActionButtons({
  guid,
  crud,
  palette,
  testIDPrefix,
}: {
  guid: string;
  crud: PMCrud;
  palette: PMPalette;
  /** e.g. "pm-tree-row" / "pm-gantt-bar" */
  testIDPrefix: string;
}) {
  const [infoCopied, flashInfo] = useFlash();
  const [linkCopied, flashLink] = useFlash();
  const onCopyInfo = async () => {
    const r: PMShareResult | undefined = await crud.copyTaskInfo(guid);
    if (r === 'copied') flashInfo();
  };
  const onShare = async () => {
    const r: PMShareResult | undefined = await crud.shareTask(guid);
    if (r === 'copied') flashLink(); // web without a share sheet: the link was copied
  };
  return (
    <>
      <PMIconButton compact size={16} testID={`${testIDPrefix}-add-stage-below-${guid}`} icon="create_new_folder" title={pmT('Add stage below')} color={palette.primary} onPress={() => crud.createStageBelow(guid)} />
      <PMIconButton compact size={16} testID={`${testIDPrefix}-add-stage-above-${guid}`} icon="drive_folder_upload" title={pmT('Add stage above')} color={palette.primary} onPress={() => crud.createStageAbove(guid)} />
      <PMIconButton compact size={16} testID={`${testIDPrefix}-edit-${guid}`} icon="edit" title={pmT('Edit')} color={palette.text} onPress={() => crud.edit(guid)} />
      <PMIconButton compact size={16} testID={`${testIDPrefix}-duplicate-${guid}`} icon="control_point_duplicate" title={pmT('Duplicate (copy below)')} color={palette.text} onPress={() => crud.duplicateTask(guid)} />
      <PMIconButton compact size={16} testID={`${testIDPrefix}-copy-info-${guid}`} icon={infoCopied ? 'check' : 'content_copy'} title={infoCopied ? 'Task info copied' : 'Copy task info'} color={infoCopied ? palette.primary : palette.text} onPress={onCopyInfo} />
      <PMIconButton compact size={16} testID={`${testIDPrefix}-share-${guid}`} icon={linkCopied ? 'check' : 'share'} title={linkCopied ? 'Link copied' : 'Share task'} color={linkCopied ? palette.primary : palette.text} onPress={onShare} />
      <PMIconButton compact size={16} testID={`${testIDPrefix}-calendar-${guid}`} icon="event" title={pmT('Add to Google Calendar')} color={palette.text} onPress={() => crud.addToGoogleCalendar(guid)} />
      <PMIconButton compact size={16} testID={`${testIDPrefix}-link-${guid}`} icon="link" title={pmT('Link: then tap the task that must wait for this one')} color={palette.text} onPress={() => crud.startLink(guid)} />
      <PMIconButton compact size={16} testID={`${testIDPrefix}-open-${guid}`} icon="open_in_new" title={pmT('Open task info')} color={palette.text} onPress={() => crud.openInfo(guid)} />
      <PMIconButton compact size={16} testID={`${testIDPrefix}-delete-${guid}`} icon="delete" title={pmT('Delete')} color={palette.error} onPress={() => crud.deleteTask(guid)} />
    </>
  );
}
