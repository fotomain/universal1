import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { ButtonPrimaryApp, ButtonTextApp, SwitchApp, TextInputApp } from '../../ui/components/common';
import IconApp from '../../ui/components/common/IconApp';
import SelectElementFromCatalog from '../inner/select_element/SelectElementFromCatalog';
import { SystemMetaData } from '../../redux/SystemMetaData';
import {
  DEPARTAMENT_ENTITY,
  DepartamentErrors,
  DepartamentRow,
  DepartamentRowJSON,
  canSelectParentDepartament,
  emptyDepartament,
  normalizeDepartament,
  validateDepartament,
} from './departamentModel';

export interface DepartamentEditModalProps {
  visible: boolean;
  organizationGUID: string;
  initialRow?: DepartamentRow | null;
  initialParentGUID?: string;
  onClose: () => void;
  onSaved?: (row: DepartamentRow) => void;
  testID?: string;
}

export default function DepartamentEditModal({
  visible,
  organizationGUID,
  initialRow,
  initialParentGUID,
  onClose,
  onSaved,
  testID = 'departament-edit-modal',
}: DepartamentEditModalProps) {
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const isNew = !initialRow?.rowGUID;

  const allDepartaments: DepartamentRow[] =
    useSelector((s: any) => s?.[DEPARTAMENT_ENTITY]?.entityDataFromServer) || [];

  // Filter departments for this organization
  const orgDepartaments = useMemo(
    () => allDepartaments.filter((d) => d.rowOwnerGUID === organizationGUID),
    [allDepartaments, organizationGUID]
  );

  // Available parents: cannot be itself, and cannot be any of its descendants
  const availableParents = useMemo(() => {
    return orgDepartaments.filter((d) => {
      if (isNew) return true;
      return canSelectParentDepartament(d.rowGUID, initialRow!.rowGUID, orgDepartaments);
    });
  }, [orgDepartaments, isNew, initialRow]);

  const [form, setForm] = useState<DepartamentRowJSON>(() => emptyDepartament(organizationGUID).rowJSON);
  const [parentGUID, setParentGUID] = useState<string>('empty');
  const [errors, setErrors] = useState<DepartamentErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (initialRow) {
        setForm(initialRow.rowJSON || emptyDepartament(organizationGUID).rowJSON);
        setParentGUID(initialRow.rowParentGUID || 'empty');
      } else {
        setForm(emptyDepartament(organizationGUID).rowJSON);
        setParentGUID(initialParentGUID && initialParentGUID !== 'empty' ? initialParentGUID : 'empty');
      }
      setErrors({});
      setSaveError(null);
    }
  }, [visible, initialRow, initialParentGUID, organizationGUID]);

  const update = <K extends keyof DepartamentRowJSON>(k: K, v: DepartamentRowJSON[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    const errKey = k as unknown as keyof DepartamentErrors;
    if (errors[errKey]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[errKey];
        return next;
      });
    }
  };

  const handleHeadSelected = (personGUID: string | null, row?: any) => {
    const headName = row?.rowJSON?.personFirstName
      ? `${row.rowJSON.personFirstName} ${row.rowJSON.personLastName || ''}`.trim()
      : row?.rowJSON?.personTitle || null;
    setForm((f) => ({
      ...f,
      headPersonGUID: personGUID,
      headPersonName: headName,
    }));
  };

  const handleSave = () => {
    const json = normalizeDepartament(form);
    const check = validateDepartament(
      json,
      organizationGUID,
      initialRow?.rowGUID,
      parentGUID,
      orgDepartaments
    );

    if (!check.valid) {
      setErrors(check.errors);
      return;
    }

    const actions = SystemMetaData[DEPARTAMENT_ENTITY]?.actions;
    if (!actions) {
      setSaveError('Departament entity actions not found');
      return;
    }

    try {
      if (isNew) {
        const newRowGUID = Crypto.randomUUID();
        const newRow: DepartamentRow = {
          rowGUID: newRowGUID,
          rowOwnerGUID: organizationGUID,
          rowParentGUID: parentGUID || 'empty',
          orderInList: Date.now(),
          rowJSON: json,
        };
        dispatch(actions.createOne(newRow));
        onSaved?.(newRow);
      } else {
        const updatedRow: DepartamentRow = {
          rowGUID: initialRow!.rowGUID,
          rowOwnerGUID: organizationGUID,
          rowParentGUID: parentGUID || 'empty',
          orderInList: initialRow!.orderInList ?? 0,
          rowJSON: json,
        };
        dispatch(actions.updateOne(updatedRow));
        onSaved?.(updatedRow);
      }
      onClose();
    } catch (err: any) {
      setSaveError(err.message || 'Error saving department');
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />
        <View
          style={[
            styles.modalContent,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconApp name="schema" size={22} color={c.primary} />
              <Text style={[styles.modalTitle, { color: c.text }]}>
                {isNew ? 'New Department' : 'Edit Department'}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} testID={`${testID}-close`}>
              <IconApp name="close" size={20} color={c.text} />
            </Pressable>
          </View>

          {/* Form */}
          <ScrollView contentContainerStyle={styles.scrollBody}>
            {saveError && (
              <View style={[styles.banner, { backgroundColor: '#ef444418', borderColor: '#ef4444' }]}>
                <IconApp name="error" size={18} color="#ef4444" />
                <Text style={[styles.bannerText, { color: '#ef4444' }]}>{saveError}</Text>
              </View>
            )}

            <TextInputApp
              testID="departament-input-name"
              label="Department Name *"
              value={form.departmentName}
              onChangeText={(v) => update('departmentName', v)}
              placeholder="e.g. Operations, Engineering, Sales"
              error={errors.departmentName}
            />

            <TextInputApp
              testID="departament-input-code"
              label="Department Code"
              value={form.departmentCode || ''}
              onChangeText={(v) => update('departmentCode', v.toUpperCase())}
              placeholder="e.g. ENG, OPS, HR"
            />

            {/* Parent Department Selection for Hierarchy */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: c.text }]}>Parent Department (Hierarchy)</Text>
              <View style={styles.parentSelector}>
                <Pressable
                  testID="departament-parent-none"
                  style={[
                    styles.parentChip,
                    {
                      backgroundColor: parentGUID === 'empty' ? `${c.primary}22` : c.background,
                      borderColor: parentGUID === 'empty' ? c.primary : c.border,
                    },
                  ]}
                  onPress={() => setParentGUID('empty')}
                >
                  <Text
                    style={[
                      styles.parentChipText,
                      { color: parentGUID === 'empty' ? c.primary : c.text },
                    ]}
                  >
                    Top-Level Department
                  </Text>
                </Pressable>

                {availableParents.map((p) => {
                  const selected = parentGUID === p.rowGUID;
                  const name = p.rowJSON?.departmentName || 'Department';
                  return (
                    <Pressable
                      key={p.rowGUID}
                      testID={`departament-parent-${p.rowGUID}`}
                      style={[
                        styles.parentChip,
                        {
                          backgroundColor: selected ? `${c.primary}22` : c.background,
                          borderColor: selected ? c.primary : c.border,
                        },
                      ]}
                      onPress={() => setParentGUID(p.rowGUID)}
                    >
                      <IconApp name="subdirectory_arrow_right" size={14} color={selected ? c.primary : c.text} />
                      <Text
                        style={[
                          styles.parentChipText,
                          { color: selected ? c.primary : c.text },
                        ]}
                      >
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {errors.rowParentGUID ? (
                <Text style={styles.errorText}>{errors.rowParentGUID}</Text>
              ) : null}
            </View>

            {/* Department Head (from Person catalog) */}
            <SelectElementFromCatalog
              testID="departament-select-head"
              entityName="personReusable"
              label="Department Head / Lead"
              placeholder="Select person from catalog..."
              value={form.headPersonGUID}
              onSelect={handleHeadSelected}
              onChange={handleHeadSelected}
            />

            <TextInputApp
              testID="departament-input-desc"
              label="Description / Purpose"
              value={form.description || ''}
              onChangeText={(v) => update('description', v)}
              placeholder="Roles and responsibilities of this unit"
              multiline
            />

            <SwitchApp
              testID="departament-switch-active"
              label="Department is active"
              value={form.isActive}
              onValueChange={(v) => update('isActive', v)}
            />
          </ScrollView>

          {/* Footer actions */}
          <View style={[styles.footerRow, { borderTopColor: c.border }]}>
            <ButtonTextApp
              testID="departament-cancel-btn"
              title="Cancel"
              onPress={onClose}
            />
            <ButtonPrimaryApp
              testID="departament-save-btn"
              title={isNew ? 'Create Department' : 'Save Changes'}
              onPress={handleSave}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 10,
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    padding: 20,
    gap: 14,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
  },
  fieldContainer: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  parentSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  parentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  parentChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
