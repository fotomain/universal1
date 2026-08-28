import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { ActiveUserState } from '../../kit8/redux/activeUserSlice';
import Clothes1UploadToDriveComponent from '../../kit8/components/upload/Clothes1UploadToDriveComponent';
import RunComputationButton from './RunComputationButton';
import {TextApp} from "../../kit8/components/common";

export default function OnTrendDasboardScreen() {
  const activeUserState = useSelector((state: any) => state.activeUserState as ActiveUserState);
  const userState = useSelector((state: any) => state.userState);
  const userGUID = userState?.userGUID || activeUserState?.activeUserGUID || '88888999999';

  return (
    <View style={styles.container}>
        <TextApp>OnTrendDasboardScreen111</TextApp>
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
