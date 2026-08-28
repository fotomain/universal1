import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { ActiveUserState } from '../../kit8/redux/activeUserSlice';
import Clothes1UploadToDriveComponent from './Clothes1UploadToDriveComponent';
import RunComputationButton from './RunComputationButton';

export default function Clothes1DashboardScreen() {
  const activeUserState = useSelector((state: any) => state.activeUserState as ActiveUserState);
  const userState = useSelector((state: any) => state.userState);
  const userGUID = userState?.userGUID || activeUserState?.activeUserGUID || '88888999999';

  return (
    <View style={styles.container}>
      <RunComputationButton
        style={styles.runButton}
        onPress={() => {
          console.log('[Clothes1] Run computation triggered for userGUID:', userGUID);
        }}
      />
      <Clothes1UploadToDriveComponent userGUID={userGUID} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  runButton: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
});
