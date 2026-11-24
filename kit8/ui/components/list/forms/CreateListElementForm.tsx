// The form of the Add button of a ReusableList of posts: the data of a NEW element, by origin type (YouTube, web page, PDF, Word, Excel, HTML, text, a person's ID card or passport).
// The Close button (left, text + icon like "Add last") and the buttons "Add last", "Add first" (right) are ONE row; the three dots icon at the top right opens Export / Share of the typed data. The inputs are the ones of the app (TextInputApp, TextAreaApp, SelectorFromApp, ButtonApp), so the form follows the design system.
// No browser tags: it runs on iOS, Android and the web. The ReusableList opens it in a window (prop CreateElementForm) and puts the row it makes first / last.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { Card, Text, useTheme } from 'react-native-paper';
import TextInputApp from '../../common/TextInputApp';
import TextAreaApp from '../../common/TextAreaApp';
import SelectorFromApp from '../../common/SelectorFromApp';
import ButtonPrimaryApp from '../../common/ButtonPrimaryApp';
import ButtonTextApp from '../../common/ButtonTextApp';
import { PMIconButton } from '../../../../pm/inner/buttons/PMIconButton';
import PMContextMenu, { PM_MENU_WIDTH } from '../../../../pm/inner/menu/PMContextMenu';
import { menuLeft, MenuAnchorPoint, useMenuAnchor } from '../reusable/useMenuAnchor';
import type { PMMenuItemProps } from '../../../../pm/inner/menu/PMMenuItem';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import { buildTableFile, exportTableFile, shareTableFile, TABLE_EXPORT_FORMATS, TableExportFormat, tableFileResultMessage } from '../../table/reusable/tableExportActions';
import { DATA_ORIGIN_TYPE, DataOriginType, readYouTubeDescription, readYouTubeTitle, urlIsYouTube } from '../../../../types/origin';
import type { DataManipulationType } from '../../../../types/manipulation';
import type { CreateListElementFormProps } from '../reusable/reusableListTypes';
import PersonDocumentDataInput from './PersonDocumentDataInput';
import type { PersonDocumentInput, PersonPhoto } from './personDocumentInputModel';
import {
  buildElementRowJSON, defaultManipulation, ELEMENT_EXPORT_COLUMNS, ELEMENT_ORIGIN_TYPES, elementExportRow, elementExtras, emptyElementValues, isPersonOrigin, manipulationsOf, NewElementValues, ORIGIN_LABEL, validateElement,
} from './createListElementModel';

export interface CreateListElementFormOwnProps extends CreateListElementFormProps {
  /** the origin types offered (default: all) */
  originTypes?: DataOriginType[];
  /** the origin selected first (default youtube) */
  initialOrigin?: DataOriginType;
  formHeaderTitle?: string;
}

export default function CreateListElementForm({ onCreateFirst, onCreateLast, onClose, originTypes = ELEMENT_ORIGIN_TYPES, initialOrigin, formHeaderTitle = 'Create New Card', testID = 'create-list-element' }: CreateListElementFormOwnProps) {
  const theme = useTheme();
  const [values, setValues] = useState<NewElementValues>(() => emptyElementValues(initialOrigin ?? originTypes[0] ?? DATA_ORIGIN_TYPE.youtube));
  const [submitted, setSubmitted] = useState(false);
  const person = isPersonOrigin(values.origin);
  const errors = useMemo(() => validateElement(values), [values]);
  const set = (patch: Partial<NewElementValues>) => setValues((v) => ({ ...v, ...patch }));
  const manipulations = useMemo(() => manipulationsOf(values.origin), [values.origin]);
  const originOptions = useMemo(() => originTypes.map((o) => ({ label: ORIGIN_LABEL[o], value: o })), [originTypes]);

  // another origin: the manipulation that is not allowed for it is replaced by the first allowed one
  useEffect(() => {
    if (!person && values.manipulation && !manipulations.includes(values.manipulation)) set({ manipulation: defaultManipulation(values.origin) });
    if (person && values.manipulation) set({ manipulation: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.origin]);

  const changeOrigin = (origin: DataOriginType) => set({ origin, manipulation: defaultManipulation(origin) });
  // an address of a YouTube video: the origin is YouTube, the title and the description are read from YouTube (as the web form does)
  const changeUrl = async (url: string) => {
    set({ url });
    if (!urlIsYouTube(url)) return;
    set({ origin: DATA_ORIGIN_TYPE.youtube, manipulation: defaultManipulation(DATA_ORIGIN_TYPE.youtube) });
    const [title, description] = await Promise.all([readYouTubeTitle(url), readYouTubeDescription(url)]);
    setValues((v) => (v.url === url ? { ...v, ...(title ? { title } : {}), ...(description ? { description } : {}) } : v));
  };

  const submit = (how: 'first' | 'last') => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    (how === 'last' ? onCreateLast : onCreateFirst)(buildElementRowJSON(values), elementExtras(values));
  };

  // ---- the three dots menu (top right): Export and Share of what is typed, the same items and formats as the More menu of the lists ----
  const dispatch = useDispatch();
  const [menuAt, setMenuAt] = useState<MenuAnchorPoint | null>(null);
  const dots = useMenuAnchor(setMenuAt);
  const runFile = async (format: TableExportFormat, share: boolean) => {
    setMenuAt(null);
    try {
      const title = values.title.trim() || 'New element';
      const file = buildTableFile(format, { title, rows: [elementExportRow(values)], columns: ELEMENT_EXPORT_COLUMNS, catalogTitle: () => '' });
      const result = share ? await shareTableFile(file, title) : await exportTableFile(file);
      const message = tableFileResultMessage(result, file.fileName);
      if (message) dispatch(showSnackbar({ message }));
    } catch (e: any) {
      dispatch(showSnackbar({ message: `${share ? 'Share' : 'Export'} failed: ${e?.message || e}` }));
    }
  };
  const menuItems: PMMenuItemProps[] = [
    { testID: `${testID}-menu-export`, label: 'Export', icon: 'download', onPress: () => {}, submenu: TABLE_EXPORT_FORMATS.map((f) => ({ testID: `${testID}-menu-export-${f.format}`, label: f.label, icon: f.icon, onPress: () => runFile(f.format, false) })) },
    { testID: `${testID}-menu-share`, label: 'Share', icon: 'share', onPress: () => {}, submenu: TABLE_EXPORT_FORMATS.map((f) => ({ testID: `${testID}-menu-share-${f.format}`, label: f.label, icon: f.icon, onPress: () => runFile(f.format, true) })) },
  ];

  return (
    <Card testID={testID} style={[styles.card, { backgroundColor: theme.colors.surface }]} mode="elevated">
      <Card.Content>
        <View style={styles.header}>
          <Text variant="titleMedium" style={[styles.headerTitle, { color: theme.colors.onSurface }]}>{formHeaderTitle}</Text>
          <View {...dots.anchorProps}>
            <PMIconButton testID={`${testID}-more`} icon="more_vert" title="More" onPress={dots.open} color={theme.colors.onSurface} />
          </View>
        </View>

        <SelectorFromApp<DataOriginType> testID={`${testID}-origin`} label="Origin type" value={values.origin} onValueChange={changeOrigin} options={originOptions} />

        {person ? (
          <PersonDocumentDataInput testID={`${testID}-person`} kind={values.origin === DATA_ORIGIN_TYPE.personPassport ? 'passport' : 'idCard'} value={values.person}
            onChange={(patch: Partial<PersonDocumentInput>) => setValues((v) => ({ ...v, person: { ...v.person, ...patch } }))}
            photo={values.photo} onPhotoChange={(photo: PersonPhoto | null) => set({ photo })} errors={submitted ? errors.person : undefined} />
        ) : (
          <>
            <TextInputApp testID={`${testID}-url`} label="Origin URL" value={values.url} onChangeText={changeUrl} placeholder="Enter URL (e.g., https://youtu.be/...)" autoFocus
              errorCheck={(text: string) => (text.trim() ? validateElement({ ...values, title: 'x', url: text }).url : null)} />
            <TextInputApp testID={`${testID}-title`} label="Title" value={values.title} onChangeText={(title: string) => set({ title })} placeholder="Enter post title"
              errorCheck={() => (submitted ? errors.title : null)} />
          </>
        )}
        {!person ? <TextAreaApp testID={`${testID}-description`} label="Description" value={values.description} onChangeText={(description: string) => set({ description })} placeholder="Enter post description" numberOfLines={2} /> : null}

        {!person && manipulations.length > 0 ? (
          <SelectorFromApp<DataManipulationType> testID={`${testID}-manipulation`} label="Data Manipulation" value={values.manipulation as DataManipulationType}
            onValueChange={(manipulation) => set({ manipulation })} options={manipulations} />
        ) : null}

        {/* ONE row: the Close button at the LEFT, Add last and Add first at the RIGHT */}
        <View style={styles.buttonRow} testID={`${testID}-buttons`}>
          <ButtonTextApp testID={`${testID}-close`} title="Close" icon="close" onPress={onClose} />
          <View style={styles.spacer} />
          <ButtonTextApp testID={`${testID}-add-last`} title="Add last" icon="playlist_add" onPress={() => submit('last')} disabled={!!errors.url} />
          <ButtonPrimaryApp testID={`${testID}-add-first`} title="Add first" icon="add" onPress={() => submit('first')} disabled={!!errors.url} />
        </View>
      </Card.Content>
      {menuAt ? <PMContextMenu testID={`${testID}-menu`} x={menuLeft(menuAt, PM_MENU_WIDTH)} y={menuAt.y} caption="New element" items={menuItems} onClose={() => setMenuAt(null)} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, marginVertical: 6, elevation: 4 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  headerTitle: { flex: 1 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', gap: 8, marginTop: 8 },
  spacer: { flex: 1 },
});
