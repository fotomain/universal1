// ReusableTable - the ⠿ grip of a row on iOS / Android when a folders tree is beside the table: press and drag the grip
// onto a folder of the tree (the drag session of ../../tree/folderTreeDnd). The web table uses its own DnD body.
import React from 'react';
import { Text, View } from 'react-native';
import type { FolderDragPayload } from '../../tree/folderTreeDnd';
import { useFolderDragSource } from '../../tree/useFolderDragSource';

export default function ReusableTableFolderGrip({ getPayload, color, testID }: { getPayload: () => FolderDragPayload | null; color: string; testID: string }) {
  const drag = useFolderDragSource({ mode: 'handle', getPayload });
  return (
    <View testID={testID} accessibilityLabel="Drag onto a folder" {...drag.props} style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, opacity: 0.7, fontSize: 16 }}>⠿</Text>
    </View>
  );
}
