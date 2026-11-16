import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { PM80SatelliteNode } from './pm80HomeModel';
import PM80Tip from './PM80Tip';

export interface PM80FlowStripProps {
  /** the circles sorted in the business order (`pm80FlowOf`) */
  nodes: PM80SatelliteNode[];
  /** a tap on a step opens the REAL screen of that step */
  onOpen: (route: string) => void;
  isDark: boolean;
  textStrong: string;
  textMuted: string;
  borderColor: string;
  surface: string;
  title?: string;
  testID?: string;
}

/**
 * "Business order": the 8 real parts of the app in the order a project is run, as a row of links.
 * Used by both the Paper and the Tamagui home.
 */
export default function PM80FlowStrip({
  nodes,
  onOpen,
  isDark,
  textStrong,
  textMuted,
  borderColor,
  surface,
  title = 'Business order',
  testID = 'pm80-flow',
}: PM80FlowStripProps) {
  return (
    <View testID={testID} style={[styles.box, { backgroundColor: surface, borderColor }]}>
      <Text style={[styles.title, { color: textMuted }]}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {nodes.map((n, i) => (
          <React.Fragment key={n.id}>
            <PM80Tip tip={n.tip}>
            <TouchableOpacity
              testID={`${testID}-step-${n.step}`}
              accessibilityLabel={`Step ${n.step}: ${n.label.replace('\n', ' ')}`}
              activeOpacity={0.8}
              onPress={() => onOpen(n.route)}
              style={[
                styles.chip,
                { backgroundColor: isDark ? n.pastelBgDark : n.pastelBgLight },
              ]}
            >
              <View style={[styles.num, { backgroundColor: n.accentColor }]}>
                <Text style={styles.numText}>{n.step}</Text>
              </View>
              <Text style={[styles.chipText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {n.label.replace('\n', ' ')}
              </Text>
            </TouchableOpacity>
            </PM80Tip>
            {i < nodes.length - 1 && (
              <Text style={[styles.arrow, { color: textStrong }]}>›</Text>
            )}
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },
  row: {
    alignItems: 'center',
    gap: 4,
    paddingRight: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 16,
  },
  num: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  arrow: {
    fontSize: 18,
    fontWeight: '300',
    marginHorizontal: 1,
  },
});
