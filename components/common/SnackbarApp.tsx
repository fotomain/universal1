import React from 'react';
import { StyleSheet } from 'react-native';
import { Snackbar as PaperSnackbar } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { hideSnackbar } from '../../kit8/redux/uxuiSlice';
import { SystemMetaData } from '../../kit8/redux/SystemMetaData';

export interface SnackbarAppProps {
  visible?: boolean;
  onDismiss?: () => void;
  children?: React.ReactNode;
  duration?: number;
  actionLabel?: string;
  undoDeleteData?: any;
  entityName?: string;
  onAction?: () => void;
  style?: any;
  testID?: string;
}

export const SnackbarApp: React.FC<SnackbarAppProps> = ({
  visible: propVisible,
  onDismiss: propOnDismiss,
  children: propChildren,
  duration: propDuration,
  actionLabel: propActionLabel,
  undoDeleteData: propUndoDeleteData,
  entityName: propEntityName,
  onAction: propOnAction,
  style,
  testID = 'snackbarApp',
}) => {
  const dispatch = useDispatch();
  const reduxSnackbar = useSelector((state: any) => state?.uxuiState?.snackbar || state?.snackbar);

  const isVisible = propVisible !== undefined ? propVisible : Boolean(reduxSnackbar?.visible);
  const message = propChildren || reduxSnackbar?.message || '';
  const duration = propDuration || reduxSnackbar?.duration || 4000;
  const undoData = propUndoDeleteData !== undefined ? propUndoDeleteData : reduxSnackbar?.undoDeleteData;
  const targetEntityName = propEntityName || reduxSnackbar?.entityName || 'mediaPostReusable';

  // 2. “undo” pressable text instead Ok must be visible on the SnackbarApp
  const actionLabel = propActionLabel || reduxSnackbar?.actionLabel || (undoData ? 'Undo' : 'OK');

  const handleDismiss = () => {
    if (propOnDismiss) {
      propOnDismiss();
    } else {
      try {
        dispatch(hideSnackbar());
      } catch (e) {}
    }
  };

  const handleAction = () => {
    if (propOnAction) {
      propOnAction();
    } else if (undoData) {
      // 3. if user press undo: new post item must be added back to the list array and createOne saga runned to create post in supabase
      try {
        const entityMetaData = SystemMetaData[targetEntityName] || SystemMetaData['mediaPostReusable'];
        const actions = entityMetaData?.actions;
        if (actions?.createOneSuccess) {
          dispatch(actions.createOneSuccess(undoData));
        }
        if (actions?.createOne) {
          dispatch(actions.createOne(undoData));
        }
      } catch (e) {
        console.error('Error executing createOne saga on undo:', e);
      }
    }
    handleDismiss();
  };

  return (
    <PaperSnackbar
      testID={testID}
      visible={isVisible}
      onDismiss={handleDismiss}
      duration={duration}
      action={{
        label: actionLabel,
        onPress: handleAction,
      }}
      style={[styles.snackbar, style]}
    >
      {message}
    </PaperSnackbar>
  );
};

const styles = StyleSheet.create({
  snackbar: {
    maxWidth: 350,
    width: '100%',
    alignSelf: 'center',
    marginBottom: 16,
  },
});

export default SnackbarApp;
