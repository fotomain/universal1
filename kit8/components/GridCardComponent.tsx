import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, Chip, Checkbox, useTheme } from 'react-native-paper';
import CardApp from '../../components/common/CardApp';
import TextInputApp from '../../components/common/TextInputApp';

// ==========================================
// 1. Row Selection Cell Renderer (Material Checkbox)
// ==========================================
export const LeftSelectCellRenderer = (props: any) => {
  const isSelected = props.node?.isSelected ? props.node.isSelected() : false;

  const handleToggleSelect = () => {
    if (props.node && typeof props.node.setSelected === 'function') {
      props.node.setSelected(!isSelected);
    }
  };

  return (
    <View style={styles.cellCheckboxContainer}>
      <Checkbox
        status={isSelected ? 'checked' : 'unchecked'}
        onPress={handleToggleSelect}
      />
    </View>
  );
};

// ==========================================
// 2. Header Select All Component (Material Checkbox)
// ==========================================
export const HeaderSelectAllComponent = (props: any) => {
  const [isAllSelected, setIsAllSelected] = useState(false);

  useEffect(() => {
    if (!props.api) return;

    const updateSelectionState = () => {
      const selectedCount = props.api.getSelectedNodes().length;
      const totalCount = props.api.getDisplayedRowCount();
      setIsAllSelected(totalCount > 0 && selectedCount === totalCount);
    };

    props.api.addEventListener('selectionChanged', updateSelectionState);
    props.api.addEventListener('modelUpdated', updateSelectionState);

    return () => {
      props.api.removeEventListener('selectionChanged', updateSelectionState);
      props.api.removeEventListener('modelUpdated', updateSelectionState);
    };
  }, [props.api]);

  const handleToggleSelectAll = () => {
    if (!props.api) return;
    if (isAllSelected) {
      props.api.deselectAll();
    } else {
      props.api.selectAll();
    }
  };

  return (
    <View style={styles.headerCheckboxContainer}>
      <Checkbox
        status={isAllSelected ? 'checked' : 'unchecked'}
        onPress={handleToggleSelectAll}
      />
    </View>
  );
};

// ==========================================
// 3. GridCardComponent (Material 3 Paper Card)
// - Editing ONLY Title and Description
// ==========================================
export const GridCardComponent = (props: any) => {
  const data = props.data;
  if (!data) return null;

  const json = data.mediaPostJSON || {};
  const guid = data.mediaPostGUID || '';

  const theme = useTheme();

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(json.mediaPostTitle || '');
  const [description, setDescription] = useState(json.mediaPostDescription || '');

  // Keep state synced with data updates
  useEffect(() => {
    setTitle(json.mediaPostTitle || '');
    setDescription(json.mediaPostDescription || '');
  }, [json.mediaPostTitle, json.mediaPostDescription]);

  // Optimistic Save (Only Title & Description)
  const handleSave = () => {
    const updatedData = {
      ...data,
      mediaPostJSON: {
        ...json,
        mediaPostTitle: title,
        mediaPostDescription: description,
      },
    };

    // 1. AgGridReact API optimistic update
    if (props.node && typeof props.node.setData === 'function') {
      props.node.setData(updatedData);
    } else if (props.api && typeof props.api.applyTransaction === 'function') {
      props.api.applyTransaction({ update: [updatedData] });
    }

    // 2. Dispatch to saga (no list re-fetch afterwards)
    if (props.context && typeof props.context.onUpdatePost === 'function') {
      props.context.onUpdatePost(guid, {
        mediaPostTitle: title,
        mediaPostDescription: description,
      }, updatedData);
    }

    setIsEditing(false);
  };

  // Optimistic Delete
  const handleDelete = () => {
    // 1. AgGridReact API remove
    if (props.api && typeof props.api.applyTransaction === 'function') {
      props.api.applyTransaction({ remove: [data] });
    }

    // 2. Dispatch to saga (no list re-fetch afterwards)
    if (props.context && typeof props.context.onDeletePost === 'function') {
      props.context.onDeletePost(guid);
    }
  };

  return (
    <CardApp style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.cardContent}>
        {isEditing ? (
          <View style={styles.editContainer}>
            <Text variant="titleSmall" style={[styles.editHeader, { color: theme.colors.primary }]}>
              ✏️ Edit Post ({guid ? guid.substring(0, 8) + '...' : ''})
            </Text>
            <TextInputApp
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Post Title"
            />
            <TextInputApp
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
            />
            <View style={styles.actionRow}>
              <IconButton
                icon="check-circle"
                mode="contained"
                containerColor={theme.colors.primary}
                iconColor={theme.colors.onPrimary}
                size={22}
                onPress={handleSave}
              />
              <IconButton
                icon="close-circle"
                mode="contained-tonal"
                iconColor={theme.colors.onSurfaceVariant}
                size={22}
                onPress={() => setIsEditing(false)}
              />
            </View>
          </View>
        ) : (
          <View style={styles.displayContainer}>
            <View style={styles.headerRow}>
              <Text variant="titleMedium" style={[styles.titleText, { color: theme.colors.onSurface }]} numberOfLines={1}>
                {title || 'Untitled Post'}
              </Text>
              <Chip compact style={[styles.chip, { backgroundColor: theme.colors.surfaceVariant }]}>
                {json.mediaPostMIME || 'post'}
              </Chip>
            </View>

            {json.mediaPostSubTitle ? (
              <Text variant="titleSmall" style={[styles.subtitleText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                {json.mediaPostSubTitle}
              </Text>
            ) : null}

            {description ? (
              <Text variant="bodyMedium" style={[styles.descText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
                {description}
              </Text>
            ) : null}

            {json.mediaPostOrigin ? (
              <Text variant="bodySmall" style={[styles.urlText, { color: theme.colors.primary }]} numberOfLines={1}>
                🔗 {json.mediaPostOrigin}
              </Text>
            ) : null}

            <Text variant="labelSmall" style={[styles.guidText, { color: theme.colors.outline }]}>
              GUID: {guid}
            </Text>

            <View style={styles.actionRow}>
              <IconButton
                icon="pencil-outline"
                mode="contained-tonal"
                iconColor={theme.colors.primary}
                size={20}
                onPress={() => setIsEditing(true)}
              />
              <IconButton
                icon="delete-outline"
                mode="contained-tonal"
                iconColor={theme.colors.error}
                size={20}
                onPress={handleDelete}
              />
            </View>
          </View>
        )}
      </View>
    </CardApp>
  );
};

export default GridCardComponent;

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  cardContent: {
    padding: 12,
  },
  cellCheckboxContainer: {
    height: '100%',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 4,
  },
  headerCheckboxContainer: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editContainer: {
    gap: 6,
  },
  editHeader: {
    fontWeight: 'bold',
    color: '#0288d1',
    marginBottom: 2,
  },
  displayContainer: {
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleText: {
    fontWeight: 'bold',
    color: '#1a237e',
    flex: 1,
  },
  chip: {
    backgroundColor: '#e8eaf6',
    marginLeft: 6,
  },
  subtitleText: {
    fontWeight: '600',
    color: '#555',
  },
  descText: {
    color: '#444',
  },
  urlText: {
    color: '#1e88e5',
  },
  guidText: {
    color: '#999',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
});
