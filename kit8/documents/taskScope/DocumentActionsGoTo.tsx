// DocumentActionsGoTo - the two buttons "Actions" and "Go to" of the bar of a document form (vendor invoice, later the other documents). Both work from the TASK the document was made from:
//   Actions  ->  "Create based on" > the items of the Task menu "Create based on this" (Fact input, Vendor Invoice, Purchase Order, Payment fact, Time sheet, Chat ...)
//                + `actionItems` of the document (e.g. "Payment fact" that pays THIS invoice), listed first
//   Go to    ->  Open task (the dashboard at the task) + the items of the Task menu "Go to" (Timeline data, Vendor invoices, Customer invoices, Payment facts, Purchase orders, Product receipts, Fact input, Time sheets)
// The items are those of useTaskRelatedMenu (kit8/pm/view/task); the rowJSON of the task and of its project are read from the database when the form opens (the PM store has no project here).
// `kind` = the kind of the document: only the Task menu items LOGICALLY related to it are shown (documentRelatedModel.ts); no kind = all of them.
// `projectGUID` may be left out: it is read from the task. `goToItems` = items of the document itself under Go to (a time sheet / payment fact has no ONE task: its list, its work center ...).
// No task and no own items (an independent document): nothing is rendered in a form bar; `alwaysShow` (the toolbar of a LIST: the buttons are there for the ONE selected document) shows them DISABLED.
// `variant`: 'buttons' (the bar of a form: text buttons) | 'icons' (the toolbar of a ReusableTable: icon buttons with a tip).
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import ButtonApp from '../../ui/components/common/ButtonApp';
import { PMIconButton } from '../../pm/inner/buttons/PMIconButton';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import PMContextMenu from '../../pm/inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../../pm/inner/menu/PMMenuItem';
import { useSupabase } from '../../providers/WithSupabase';
import { pmT } from '../../pm/i18n/pmT';
import { useTaskRelatedMenu } from '../../pm/view/task/useTaskRelatedMenu';
import { openDashboardLink } from '../../pm/view/project/dashboardDeepLink';
import { openTaskScopedList } from './openTaskScopedList';
import { EMPTY_TASK_SCOPE } from './taskScopeModel';
import { DOCUMENT_RELATED, DocumentKind, onlyRelated } from './documentRelatedModel';

/** the rowJSON of a task and of its project (+ the GUID of the project when the caller did not know it), read once (the subproject / chat items look at them) */
export function useTaskAndProjectRows(taskGUID: string, projectHint: string) {
  const { supabase } = useSupabase();
  const [rows, setRows] = useState<{ task: Record<string, any> | null; project: Record<string, any> | null; projectGUID: string }>({ task: null, project: null, projectGUID: projectHint });
  useEffect(() => {
    let alive = true;
    setRows({ task: null, project: null, projectGUID: projectHint });
    if (!taskGUID) return undefined;
    (async () => {
      try {
        const t: any = await supabase.from('project_task_table').select('rowJSON, projectGUID').eq('rowGUID', taskGUID).maybeSingle();
        const projectGUID = projectHint || String(t?.data?.projectGUID ?? '');
        const p: any = projectGUID ? await supabase.from('project_table').select('rowJSON').eq('rowGUID', projectGUID).maybeSingle() : { data: null };
        if (alive) setRows({ task: (t?.data?.rowJSON as Record<string, any>) ?? {}, project: (p?.data?.rowJSON as Record<string, any>) ?? {}, projectGUID });
      } catch {
        if (alive) setRows({ task: {}, project: {}, projectGUID: projectHint });
      }
    })();
    return () => { alive = false; };
  }, [taskGUID, projectHint]); // eslint-disable-line react-hooks/exhaustive-deps
  return rows;
}

export interface DocumentActionsGoToProps {
  taskGUID?: string;
  projectGUID?: string;
  /** items of the document itself, listed first under Actions (e.g. the next document of the chain, "Payment fact (pays this invoice)") */
  actionItems?: PMMenuItemProps[];
  /** items of the document itself, listed first under Go to (a document with no ONE task: its list, its work center) */
  goToItems?: PMMenuItemProps[];
  /** the list of the documents of this kind (all of them, not filtered): an item of Go to - for the documents that have no ONE task (time sheet, payment fact) */
  ownList?: { route: string; label: string; icon: string };
  disabled?: boolean;
  testID?: string;
  variant?: 'buttons' | 'icons';
  /** the kind of the document: the Actions / Go to items are cut to the ones logically related to it */
  kind?: DocumentKind;
  /** show the (disabled) buttons also when there is no task */
  alwaysShow?: boolean;
}

type Which = 'actions' | 'goto';

export default function DocumentActionsGoTo({ taskGUID = '', projectGUID = '', actionItems = [], goToItems = [], ownList, kind, disabled, testID = 'document', variant = 'buttons', alwaysShow }: DocumentActionsGoToProps) {
  const own = actionItems.length + goToItems.length > 0 || !!ownList;
  if (!taskGUID && !own && !alwaysShow) return null;
  return <Buttons taskGUID={taskGUID} projectHint={projectGUID} actionItems={actionItems} goToItems={goToItems} ownList={ownList} kind={kind} disabled={disabled} testID={testID} variant={variant} />;
}

function Buttons({ taskGUID, projectHint, actionItems, goToItems, ownList, kind, disabled, testID, variant }: { taskGUID: string; projectHint: string; actionItems: PMMenuItemProps[]; goToItems: PMMenuItemProps[]; ownList?: DocumentActionsGoToProps['ownList']; kind?: DocumentKind; disabled?: boolean; testID: string; variant: 'buttons' | 'icons' }) {
  const { themeColors } = useDesignSystem();
  const router = useRouter();
  const related = useTaskRelatedMenu();
  const { task, project, projectGUID } = useTaskAndProjectRows(taskGUID, projectHint);
  const actionsRef = useRef<View>(null);
  const gotoRef = useRef<View>(null);
  const [menu, setMenu] = useState<{ which: Which; x: number; y: number } | null>(null);

  const close = () => setMenu(null);
  const open = (which: Which) => {
    const node: any = (which === 'actions' ? actionsRef : gotoRef).current;
    if (node?.measureInWindow) node.measureInWindow((x: number, y: number, _w: number, h: number) => setMenu({ which, x, y: y + h + 2 }));
    else setMenu({ which, x: 8, y: 56 });
  };

  // the Task menu submenus of the task of the document (none until the task has been read)
  const submenus = task && projectGUID ? related({ taskGUID, projectGUID, idPrefix: `${testID}-task`, close, taskRowJSON: task, projectRowJSON: project }) : [];
  const related_ = kind ? DOCUMENT_RELATED[kind] : undefined;
  const createItems = onlyRelated(submenus.find((it) => it.testID.endsWith('-create'))?.submenu ?? [], '-create-', related_?.actions);
  const taskGoto = onlyRelated(submenus.find((it) => it.testID.endsWith('-goto'))?.submenu ?? [], '-goto-', related_?.goTo);

  // the items of the document close the menu first, like the Task menu items do
  const actions: PMMenuItemProps[] = [...actionItems.map((it) => ({ ...it, onPress: () => { close(); it.onPress(); } })), ...createItems];
  const closing = (items: PMMenuItemProps[]) => items.map((it) => ({ ...it, onPress: () => { close(); it.onPress(); } }));
  const goTo: PMMenuItemProps[] = [
    ...closing(goToItems),
    ...(ownList ? [{ testID: `${testID}-goto-own-list`, label: pmT(ownList.label), icon: ownList.icon, onPress: () => { close(); openTaskScopedList(ownList.route, EMPTY_TASK_SCOPE, router); } }] : []),
    ...(taskGUID && projectGUID ? [{ testID: `${testID}-goto-open-task`, label: pmT('Open task'), icon: 'open_in_new', onPress: () => { close(); openDashboardLink({ projectGUID, taskGUID }, router); } }] : []),
    ...taskGoto,
  ];

  return (
    <>
      <View ref={actionsRef} collapsable={false}>
        {variant === 'icons'
          ? <PMIconButton tipScope="app" testID={`${testID}-actions`} icon="bolt" title={pmT('Actions: create documents based on the selected document')} color={themeColors.text} disabled={disabled || !actions.length} onPress={() => open('actions')} />
          : <ButtonApp testID={`${testID}-actions`} title={pmT('Actions')} icon="bolt" variant="outlined" size="small" disabled={disabled || !actions.length} onPress={() => open('actions')} />}
      </View>
      <View ref={gotoRef} collapsable={false}>
        {variant === 'icons'
          ? <PMIconButton tipScope="app" testID={`${testID}-goto`} icon="arrow_top_left" title={pmT('Go to: the task and the documents of the selected document')} color={themeColors.text} disabled={disabled || !goTo.length} onPress={() => open('goto')} />
          : <ButtonApp testID={`${testID}-goto`} title={pmT('Go to')} icon="arrow_top_left" variant="outlined" size="small" disabled={disabled || !goTo.length} onPress={() => open('goto')} />}
      </View>
      {!!menu && (
        <PMContextMenu
          testID={`${testID}-${menu.which}-menu`}
          x={menu.x}
          y={menu.y}
          width={230}
          caption={pmT(menu.which === 'actions' ? 'Create based on this' : 'Go to')}
          onClose={close}
          items={menu.which === 'actions' ? actions : goTo}
        />
      )}
    </>
  );
}
