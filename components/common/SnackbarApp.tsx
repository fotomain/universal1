import React from 'react';
import { StyleSheet } from 'react-native';
import { Snackbar as PaperSnackbar } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { hideSnackbar } from '../../kit8/redux/uxuiSlice';

export interface SnackbarAppProps {
  visible?: boolean;
  onDismiss?: () => void;
  children?: React.ReactNode;
  duration?: number;
  actionLabel?: string;
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
  onAction: propOnAction,
  style,
  testID = 'snackbarApp',
}) => {
  const dispatch = useDispatch();
  const reduxSnackbar = useSelector((state: any) => state?.uxuiState?.snackbar || state?.snackbar);

  const isVisible = propVisible !== undefined ? propVisible : Boolean(reduxSnackbar?.visible);
  const message = propChildren || reduxSnackbar?.message || '';
  const duration = propDuration || reduxSnackbar?.duration || 3000;
  const actionLabel = propActionLabel || reduxSnackbar?.actionLabel || 'OK';

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
    marginBottom: 16,
  },
});

export default SnackbarApp;
