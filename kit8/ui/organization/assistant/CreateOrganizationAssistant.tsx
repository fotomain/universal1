// CreateOrganizationAssistant - the Create Organization Assistant (route /catalog/organization/assistant; React Native Paper, the look of the Create New Project Assistant).
//   questions   the organization (name, legal name, country, contact) -> legal data -> currencies (the defaults of a new project + the consolidation currency) -> resource calendars -> review
//   save        "Create organization": the row is made (the creator = its administrator), it becomes the ACTIVE organization of the user
//   then        1. "Continue to create Project?"  Yes = the Create New Project Assistant (/pm/project/assistant, in the new organization)
//                                                  No  = 2. "Set up the default settings for projects?"
//                                                        Yes = the same project assistant WITHOUT the name and the dates (target=organization): its answers are stored as the default
//                                                              project settings of the organization
//                                                        No  = the default project settings (the currencies of this assistant + the built-in defaults of every setting) are stored in the
//                                                              organization's settings and the user is back in the list of organizations
// The row, its owner and the settings go through saveOrganization.ts (straight to Supabase: the assistant must know whether the row was made).
import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Card, Divider, HelperText, List, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { pmT } from '../../../pm/i18n/pmT';
import { useSupabase } from '../../../providers/WithSupabase';
import SelectElementFromCatalog from '../../../catalog/inner/select_element/SelectElementFromCatalog';
import { defaultProjectSettingsOf } from '../../../catalog/organization/defaultProjectSettings';
import { useOrganizationMemberships } from '../../../catalog/organization/switch/useOrganizationMemberships';
import { useSwitchOrganization } from '../../../catalog/organization/switch/useSwitchOrganization';
import { CAPACITY_MODES } from '../../../pm/view/task/plan/busyControl';
import AssistantNavigationBar, { type AssistantNavStep } from '../../project/assistant/components/AssistantNavigationBar';
import ExpertTipCard from '../../project/assistant/components/ExpertTipCard';
import { ChipChoice, CurrencyField } from '../../project/assistant/components/AssistantFields';
import {
  ORG_ASSISTANT_STEP_IDS,
  defaultOrgAssistantValues,
  firstOrgStepWithError,
  nextOrgStepId,
  orgAssistantRowJSON,
  orgAssistantStepDefOf,
  orgAssistantValidation,
  orgCurrencyDefaults,
  orgHasError,
  orgReviewLines,
  orgStepNotes,
  previousOrgStepId,
  type OrgAssistantStepId,
  type OrgAssistantValues,
} from './organizationAssistantModel';
import { insertOrganization, saveOrganizationDefaultSettings } from './saveOrganization';

type Phase = 'steps' | 'askProject' | 'askDefaults';

export interface CreateOrganizationAssistantProps {
  /** tests: the e-mail of the user / the Supabase client instead of the real hooks */
  userEmail?: string;
}

const PROJECT_ASSISTANT = '/pm/project/assistant';
const ORGANIZATION_LIST = '/catalog/organization';

export default function CreateOrganizationAssistant(props: CreateOrganizationAssistantProps) {
  const router = useRouter();
  const theme = useTheme();
  const win = useWindowDimensions();
  const { supabase } = useSupabase();
  const reduxEmail: string = useSelector((s: any) => s?.activeUserState?.activeUserEmail) || '';
  const userEmail = (props.userEmail ?? reduxEmail).trim().toLowerCase();
  const { memberships, reload: reloadMemberships } = useOrganizationMemberships();
  const switchOrganization = useSwitchOrganization();

  const [phase, setPhase] = React.useState<Phase>('steps');
  const [values, setValues] = React.useState<OrgAssistantValues>(() => defaultOrgAssistantValues(userEmail));
  const [stepId, setStepId] = React.useState<OrgAssistantStepId>('identity');
  const [reached, setReached] = React.useState<OrgAssistantStepId[]>(['identity']);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ rowGUID: string; title: string } | null>(null);

  // the e-mail arrives after the first render in the app: the contact e-mail starts as it, until the user typed one
  React.useEffect(() => {
    setValues((v) => (v.contactEmail || !userEmail ? v : { ...v, contactEmail: userEmail }));
  }, [userEmail]);

  const ctx = React.useMemo(() => ({ existingTitles: memberships.map((m) => m.organizationTitle) }), [memberships]);
  const change = (patch: Partial<OrgAssistantValues>) => setValues((v) => ({ ...v, ...patch }));
  const notes = React.useMemo(() => orgStepNotes(stepId, values, ctx), [stepId, values, ctx]);
  const blocking = React.useMemo(() => firstOrgStepWithError(values, ctx), [values, ctx]);

  const goto = (id: OrgAssistantStepId) => { if (reached.includes(id) || id === stepId) setStepId(id); };
  const next = () => {
    if (orgHasError(notes)) return;
    const id = nextOrgStepId(stepId);
    if (!id) return;
    setStepId(id);
    setReached((r) => (r.includes(id) ? r : [...r, id]));
  };
  const back = () => {
    const id = previousOrgStepId(stepId);
    if (id) setStepId(id);
    else if (router.canGoBack?.()) router.back();
    else router.replace(ORGANIZATION_LIST as any);
  };
  const exit = () => { if (router.canGoBack?.()) router.back(); else router.replace(ORGANIZATION_LIST as any); };

  const create = async () => {
    if (busy) return;
    if (blocking) { setStepId(blocking); setReached((r) => (r.includes(blocking) ? r : [...r, blocking])); setMessage('Some answers must be corrected first.'); return; }
    const check = orgAssistantValidation(values, userEmail);
    if (!check.valid) { setMessage(Object.values(check.errors)[0] || 'The organization cannot be saved.'); return; }
    setBusy(true);
    try {
      const saved = await insertOrganization(supabase, userEmail, orgAssistantRowJSON(values, userEmail));
      if (!saved.ok) { setMessage(saved.error); return; }
      // the new organization is the one the user works in now: the project assistant that may follow makes its project there
      const switched = await switchOrganization(saved.rowGUID);
      reloadMemberships();
      setCreated({ rowGUID: saved.rowGUID, title: values.organizationTitle.trim() });
      if (!switched) setMessage('The organization was made, but it could not be made the active one: pick it in the Organization filter.');
      setPhase('askProject');
    } finally {
      setBusy(false);
    }
  };

  const projectYes = () => router.replace({ pathname: PROJECT_ASSISTANT, params: { mode: 'assistant', target: 'new' } } as any);
  const projectNo = () => setPhase('askDefaults');
  const defaultsYes = () => router.replace({ pathname: PROJECT_ASSISTANT, params: { mode: 'assistant', target: 'organization' } } as any);
  const defaultsNo = async () => {
    if (!created || busy) return;
    setBusy(true);
    try {
      // the default project settings of the organization are STORED: the currencies of the answers over the built-in default of every other setting
      const saved = await saveOrganizationDefaultSettings(supabase, created.rowGUID, defaultProjectSettingsOf(orgCurrencyDefaults(values)));
      if (!saved.ok) { setMessage(saved.error); return; }
      router.replace(ORGANIZATION_LIST as any);
    } finally {
      setBusy(false);
    }
  };

  const steps: AssistantNavStep[] = phase === 'steps'
    ? ORG_ASSISTANT_STEP_IDS.map((id) => ({
        id,
        label: orgAssistantStepDefOf(id).title,
        state: id === stepId ? 'current' : reached.includes(id) && ORG_ASSISTANT_STEP_IDS.indexOf(id) < ORG_ASSISTANT_STEP_IDS.indexOf(stepId) ? 'done' : 'todo',
        enabled: reached.includes(id) || id === stepId,
      }))
    : [];
  const panelHeight = Math.max(420, Math.min(720, win.height - 190));
  const signedIn = !!userEmail;

  let body: React.ReactNode;
  if (!signedIn) {
    body = (
      <Card mode="outlined" testID="org-assistant-signin">
        <Card.Title title={pmT('Sign in first')} subtitle={pmT('The assistant makes an organization with you as its administrator.')} />
        <Card.Actions>
          <Button mode="contained" onPress={() => router.push({ pathname: '/user/signin', params: { returnTo: '/catalog/organization/assistant' } } as any)}>{pmT('Sign in')}</Button>
        </Card.Actions>
      </Card>
    );
  } else if (phase === 'askProject') {
    body = (
      <Card mode="outlined" testID="org-assistant-ask-project">
        <Card.Title title={pmT('Continue to create Project?')} subtitle={pmT('The organization "{{name}}" is made and is your active organization.', { name: created?.title || '' })} />
        <Card.Actions>
          <Button mode="outlined" onPress={projectNo} testID="org-assistant-project-no">{pmT('No')}</Button>
          <Button mode="contained" onPress={projectYes} testID="org-assistant-project-yes">{pmT('Yes')}</Button>
        </Card.Actions>
      </Card>
    );
  } else if (phase === 'askDefaults') {
    body = (
      <Card mode="outlined" testID="org-assistant-ask-defaults">
        <Card.Title title={pmT('Set up the default settings for projects?')} subtitle={pmT('A new project of the organization starts from them. Answer the questions of the project assistant (no name, no dates) or keep the standard defaults.')} subtitleNumberOfLines={4} />
        <Card.Actions>
          <Button mode="outlined" onPress={() => { void defaultsNo(); }} disabled={busy} testID="org-assistant-defaults-no">{pmT('No, keep the standard defaults')}</Button>
          <Button mode="contained" onPress={defaultsYes} disabled={busy} testID="org-assistant-defaults-yes">{pmT('Yes')}</Button>
        </Card.Actions>
      </Card>
    );
  } else {
    body = (
      <View testID={`org-assistant-step-body-${stepId}`}>
        <Text variant="headlineSmall" style={styles.stepTitle}>{`${ORG_ASSISTANT_STEP_IDS.indexOf(stepId) + 1}. ${pmT(orgAssistantStepDefOf(stepId).title)}`}</Text>
        <ExpertTipCard testID="org-assistant-expert" tip={orgAssistantStepDefOf(stepId).tip} notes={notes} />
        <OrgStep stepId={stepId} values={values} onChange={change} onJump={goto} />
      </View>
    );
  }

  const isReview = phase === 'steps' && stepId === 'review';
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]} testID="create-organization-assistant">
      <AssistantNavigationBar
        title="New organization assistant"
        subtitle={phase === 'steps' && values.organizationTitle.trim() ? values.organizationTitle.trim() : undefined}
        steps={steps}
        onBack={phase === 'steps' ? back : exit}
        onJump={(id) => goto(id as OrgAssistantStepId)}
        testID="org-assistant-nav"
      />
      <View style={[styles.panel, { height: panelHeight }, win.width > 760 && styles.panelWide]} testID="org-assistant-panel">
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
        {phase === 'steps' && signedIn && (
          <View style={styles.footer} testID="org-assistant-footer">
            <Button mode="outlined" onPress={back} testID="org-assistant-footer-back">{pmT('Back')}</Button>
            <View style={styles.spacer} />
            {isReview ? (
              <Button mode="contained" onPress={() => { void create(); }} disabled={!!blocking || busy} testID="org-assistant-create">{pmT(busy ? 'Creating ...' : 'Create organization')}</Button>
            ) : (
              <Button mode="contained" onPress={next} disabled={orgHasError(notes)} testID="org-assistant-next">{pmT('Next')}</Button>
            )}
          </View>
        )}
      </View>
      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={6000}>{message ? pmT(message) : ''}</Snackbar>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------- the steps

function Field({ id, label, value, onChange, helper, placeholder, keyboardType, autoCapitalize, maxLength, autoFocus }: { id: string; label: string; value: string; onChange: (v: string) => void; helper?: string; placeholder?: string; keyboardType?: any; autoCapitalize?: any; maxLength?: number; autoFocus?: boolean }) {
  return (
    <View style={styles.field}>
      <TextInput mode="outlined" label={pmT(label)} value={value} onChangeText={onChange} placeholder={placeholder} keyboardType={keyboardType} autoCapitalize={autoCapitalize ?? 'none'} autoCorrect={false} maxLength={maxLength} autoFocus={autoFocus} testID={`org-assistant-input-${id}`} />
      <HelperText type="info" visible={!!helper}>{helper ? pmT(helper) : ''}</HelperText>
    </View>
  );
}

function OrgStep({ stepId, values, onChange, onJump }: { stepId: OrgAssistantStepId; values: OrgAssistantValues; onChange: (p: Partial<OrgAssistantValues>) => void; onJump: (id: OrgAssistantStepId) => void }) {
  if (stepId === 'identity') {
    return (
      <View>
        <Field id="title" label="Organization name" value={values.organizationTitle} onChange={(organizationTitle) => onChange({ organizationTitle })} placeholder="Universal Timber" maxLength={140} autoFocus autoCapitalize="sentences" />
        <Field id="legalName" label="Legal name" value={values.organizationLegalName} onChange={(organizationLegalName) => onChange({ organizationLegalName })} placeholder="Universal Timber Corporation SIA" autoCapitalize="sentences" />
        <View style={styles.field}>
          <SelectElementFromCatalog
            testID="org-assistant-country"
            entityName="countryReusable"
            label={pmT('Country of residence')}
            placeholder={values.countryOfResidence || pmT('Select country...')}
            value={values.countryOfResidence}
            onSelect={(guid: any, row: any) => onChange({ countryOfResidence: String(row?.rowJSON?.countryCode || guid || 'LV').toUpperCase() })}
            onChange={(guid: any, row: any) => onChange({ countryOfResidence: String(row?.rowJSON?.countryCode || guid || '').toUpperCase() })}
          />
        </View>
        <Field id="contactEmail" label="Contact e-mail" value={values.contactEmail} onChange={(contactEmail) => onChange({ contactEmail })} keyboardType="email-address" />
        <Field id="contactPhone" label="Contact phone" value={values.contactPhone} onChange={(contactPhone) => onChange({ contactPhone })} keyboardType="phone-pad" />
        <Field id="website" label="Website" value={values.website} onChange={(website) => onChange({ website })} placeholder="https://" />
        <Field id="notes" label="Notes" value={values.notes} onChange={(notes) => onChange({ notes })} autoCapitalize="sentences" />
      </View>
    );
  }
  if (stepId === 'legal') {
    return (
      <View>
        <Field id="registrationNo" label="Registration number" value={values.registrationNo} onChange={(registrationNo) => onChange({ registrationNo })} />
        <Field id="vatNo" label="VAT number" value={values.vatNo} onChange={(vatNo) => onChange({ vatNo })} placeholder="LV12345678901" autoCapitalize="characters" helper="With the country prefix." />
        <Field id="legalAddress" label="Legal address" value={values.legalAddress} onChange={(legalAddress) => onChange({ legalAddress })} autoCapitalize="sentences" />
        <Field id="bankIban" label="Bank account (IBAN)" value={values.bankIban} onChange={(bankIban) => onChange({ bankIban })} autoCapitalize="characters" />
      </View>
    );
  }
  if (stepId === 'currencies') {
    return (
      <View>
        <CurrencyField id="org-budget" label="Budget currency of a new project" value={values.currencyForBudget} onChange={(currencyForBudget) => onChange({ currencyForBudget })} editable helper="The currency management reads a new project in." />
        <CurrencyField id="org-accounting" label="Accounting currency of a new project" value={values.currencyForAccounting} onChange={(currencyForAccounting) => onChange({ currencyForAccounting })} editable helper="The currency of the legal books." />
        <CurrencyField id="org-contract" label="Default currency for contracts" value={values.currencyForContract} onChange={(currencyForContract) => onChange({ currencyForContract })} editable helper="Empty = the budget currency." />
        <CurrencyField id="org-consolidation" label="Consolidation currency" value={values.currencyForConsolidation} onChange={(currencyForConsolidation) => onChange({ currencyForConsolidation })} editable helper="The money of ALL projects is added in this currency." />
      </View>
    );
  }
  if (stepId === 'resources') {
    return (
      <ChipChoice
        id="capacity"
        label="A resource booked above its calendar"
        items={CAPACITY_MODES.map((m) => ({ value: m.mode, label: m.label }))}
        value={values.resourceCapacityStrongMode}
        onChange={(resourceCapacityStrongMode) => onChange({ resourceCapacityStrongMode })}
        hint={CAPACITY_MODES.find((m) => m.mode === values.resourceCapacityStrongMode)?.hint}
      />
    );
  }
  const lines = orgReviewLines(values);
  return (
    <View testID="org-assistant-review">
      {lines.map((l, i) => (
        <View key={`${l.id}-${l.label}`}>
          <List.Item testID={`org-assistant-review-${i}`} title={pmT(l.label)} description={l.value} right={(p) => <List.Icon {...p} icon="pencil-outline" />} onPress={() => onJump(l.id)} />
          <Divider />
        </View>
      ))}
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
  field: { marginBottom: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  spacer: { flex: 1 },
});
