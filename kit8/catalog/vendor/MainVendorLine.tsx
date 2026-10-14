// MainVendorLine - "Main vendor: Acme Supplies · S-1" under a card / row; mounted ONLY when the item has a main vendor (it reads the partner and contract entities from redux).
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { PARTNER_ENTITY } from '../partner/partnerModel';
import { CONTRACT_ENTITY } from '../contract/contractModel';
import { mainVendorText } from './mainVendorModel';

export default function MainVendorLine({ vendorGUID, contractGUID, testID }: { vendorGUID: string; contractGUID?: string | null; testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const partners: any[] = useSelector((s: any) => s?.[PARTNER_ENTITY]?.entityDataFromServer) || [];
  const contracts: any[] = useSelector((s: any) => s?.[CONTRACT_ENTITY]?.entityDataFromServer) || [];
  return <Text testID={testID} numberOfLines={1} style={[styles.line, { color: c.text }]}>{mainVendorText(vendorGUID, contractGUID, partners, contracts)}</Text>;
}
const styles = StyleSheet.create({ line: { fontSize: 11, opacity: 0.7 } });
