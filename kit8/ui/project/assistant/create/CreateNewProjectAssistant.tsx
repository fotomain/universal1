// CreateNewProjectAssistant - the Create New Project Assistant (route /pm/project/assistant). React Native Paper (the MD3 theme of the app).
//   first screen   How do you want to create the project? Assistant mode | Manual input | Import Project   (AssistantStartScreen)
//   assistant      the questions in the order a project manager decides them (model/assistantModel.ts), with the expert advice of each step, a NAVIGATION LINE at the top
//                  (go back to any step already seen), Back / Next at the bottom of ONE panel of a FIXED height (the body scrolls inside it, the buttons stay at the same place on every step), and "Save and exit": the answers stay on the device and the next run offers to continue
//   end            "Create project" (the New project window is filled and saved at once) or "Open in the project window" (filled, the user saves)
//   called from    the first screen of "+ Project", the FAB of the home (appPM80) or the three dots menu of the Project settings window (mode=assistant)
//   target=organization   (?mode=assistant&target=organization, from the Create Organization Assistant) the SAME questions without the name and the dates; the end is "Save as default settings":
//                         the answers become the default project settings of the active organization (a new project of it starts from them) and no project is made
// The currencies are asked ONLY while the organization has no project (they become the currencies of the organization); otherwise they are shown read only.
import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Card, Snackbar, Text, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { pmT } from '../../../../pm/i18n/pmT';
import { usePMStore } from '../../../../pm/store/store_pm';
import AssistantNavigationBar, { type AssistantNavStep } from '../components/AssistantNavigationBar';
import ExpertTipCard from '../components/ExpertTipCard';
import StepView from '../steps/StepView';
import AssistantStartScreen from './AssistantStartScreen';
import { useAssistantEnvironment, type AssistantEnvironment } from '../hooks/useAssistantEnvironment';
import { useCreateAssistant } from '../hooks/useCreateAssistant';
import { ASSISTANT_ORGANIZATION_TARGET, assistantStepDef, visibleSteps } from '../model/assistantModel';
import { canGoNext, canJumpTo } from '../model/assistantFlow';

export interface CreateNewProjectAssistantProps {
  /** 'assistant' = skip the first screen (the three dots menu of a project window) */
  mode?: string;
  /** 'new', the GUID of a project, or 'organization' (the default project settings of the active organization) */
  target?: string;
  /** tests: the environment instead of the real hooks */
  environment?: AssistantEnvironment;
}

export default function CreateNewProjectAssistant(props: CreateNewProjectAssistantProps) {
  const params = useLocalSearchParams<{ mode?: string; target?: string }>();
  const mode = props.mode ?? (typeof params?.mode === 'string' ? params.mode : undefined);
  const target = props.target ?? (typeof params?.target === 'string' && params.target ? params.target : 'new');
  const realEnv = useAssistantEnvironment();
  const env = props.environment ?? realEnv;
  const router = useRouter();
  const theme = useTheme();
  const win = useWindowDimensions();
  const [message, setMessage] = React.useState<string | null>(null);

  const forOrganization = target === ASSISTANT_ORGANIZATION_TARGET;

  const leave = React.useCallback(
    (reason: 'finished' | 'exit') => {
      if (reason === 'finished') router.replace((forOrganization ? '/catalog/organization' : '/pm/project/dashboard') as any);
      else if (router.canGoBack?.()) router.back();
      else router.replace((forOrganization ? '/catalog/organization' : '/home') as any);
    },
    [router, forOrganization],
  );

  const a = useCreateAssistant({ env, target, mode, onLeave: leave, saveOrganizationDefaults: forOrganization ? env.saveOrganizationDefaults : undefined });
  const signedIn = !!env.ownerGUID;
  const { state, ctx } = a;

  // ---- the three ways of the first screen
  const manual = () => {
    usePMStore.getState().openProjectSettings('new'); // the project bar of the dashboard opens the New project window
    router.replace('/pm/project/dashboard' as any);
  };
  const importProject = () => router.push('/pm/project/assistant/import' as any);

  const steps: AssistantNavStep[] =
    state.phase === 'steps'
      ? visibleSteps(state.values, ctx).map((id) => ({
          id,
          label: assistantStepDef(id).title,
          state: id === state.stepId ? 'current' : state.reached.includes(id) && visibleSteps(state.values, ctx).indexOf(id) < visibleSteps(state.values, ctx).indexOf(state.stepId) ? 'done' : 'todo',
          enabled: canJumpTo(state, id, ctx),
        }))
      : [];

  const title = forOrganization ? 'Default settings for projects' : target === 'new' ? 'New project assistant' : 'Project assistant';
  const wide = win.width > 760;
  // fixed for all steps; the navigation bar (title, chips, progress) takes about 150 px above it
  const panelHeight = Math.max(420, Math.min(720, win.height - 190));

  let body: React.ReactNode;
  if (!signedIn) {
    body = (
      <Card mode="outlined" testID="assistant-signin">
        <Card.Title title={pmT('Sign in first')} subtitle={pmT('The assistant creates a project in your organization.')} />
        <Card.Actions>
          <Button mode="contained" onPress={() => router.push({ pathname: '/user/signin', params: { returnTo: '/pm/project/assistant' } } as any)}>{pmT('Sign in')}</Button>
        </Card.Actions>
      </Card>
    );
  } else if (state.phase === 'start') {
    body = <AssistantStartScreen saved={a.saved} canCreate={a.savedLoaded} onAssistant={a.startAssistant} onManual={manual} onImport={importProject} onResume={a.resume} />;
  } else if (state.phase === 'resume') {
    body = <AssistantStartScreen saved={a.saved} canCreate onAssistant={a.startAssistant} onManual={manual} onImport={importProject} onResume={a.resume} />;
  } else if (state.phase === 'steps') {
    const def = assistantStepDef(state.stepId);
    body = (
      <View testID={`assistant-step-body-${state.stepId}`}>
        <Text variant="headlineSmall" style={styles.stepTitle}>{`${visibleSteps(state.values, ctx).indexOf(state.stepId) + 1}. ${pmT(def.title)}`}</Text>
        <ExpertTipCard tip={def.tip} notes={a.notes} />
        <StepView stepId={state.stepId} values={state.values} ctx={ctx} onChange={a.change} onJump={a.jump} />
      </View>
    );
  } else {
    body = null;
  }

  const isReview = state.phase === 'steps' && state.stepId === 'review';
  const showFooter = state.phase === 'steps' && signedIn;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]} testID="create-new-project-assistant">
      <AssistantNavigationBar
        title={title}
        subtitle={!forOrganization && state.phase === 'steps' && state.values.name.trim() ? state.values.name.trim() : undefined}
        steps={steps}
        onBack={a.goBack}
        onJump={(id) => a.jump(id as any)}
        onExit={state.phase === 'steps' ? a.exit : undefined}
      />
      {/* ONE panel of a FIXED height for every step: the body scrolls inside it, Back / Next stand at the same place on every step */}
      <View style={[styles.panel, { height: panelHeight }, wide && styles.panelWide]} testID="assistant-panel">
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
        {showFooter && (
          <View style={styles.footer} testID="assistant-footer">
            <Button mode="outlined" onPress={a.goBack} testID="assistant-footer-back">{pmT('Back')}</Button>
            <View style={styles.spacer} />
            {isReview && forOrganization ? (
              <Button mode="contained" onPress={async () => { const r = await a.finish(true); if (r.message) setMessage(r.message); }} disabled={!!a.blocking} testID="assistant-save-defaults">{pmT('Save as default settings')}</Button>
            ) : isReview ? (
              <>
                <Button mode="outlined" onPress={async () => { const r = await a.finish(false); if (r.message) setMessage(r.message); }} disabled={!!a.blocking} testID="assistant-open-window">{pmT('Open in the project window')}</Button>
                <Button mode="contained" onPress={async () => { const r = await a.finish(true); if (r.message) setMessage(r.message); }} disabled={!!a.blocking} testID="assistant-create" style={styles.primary}>{pmT(state.phase === 'steps' && target !== 'new' ? 'Apply and save' : 'Create project')}</Button>
              </>
            ) : (
              <Button mode="contained" onPress={a.next} disabled={!canGoNext(state, ctx)} testID="assistant-next">{pmT('Next')}</Button>
            )}
          </View>
        )}
      </View>
      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={6000}>{message || ''}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: { width: '100%', alignSelf: 'center' },
  panelWide: { maxWidth: 720 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 16 },
  stepTitle: { marginBottom: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  spacer: { flex: 1 },
  primary: { marginLeft: 4 },
});
