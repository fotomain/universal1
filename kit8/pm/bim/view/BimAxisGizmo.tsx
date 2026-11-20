// BimAxisGizmo - the XYZ orientation scheme in a corner of the 3D view: three axes that turn with the camera, so the user always sees how the model stands.
//   X red   = east   (to the right when the camera looks north)
//   Y green = UP     (the height of the building)
//   Z blue  = south  (the model is Y up, Z towards the viewer when the camera looks north; the IFC has Z up and Y north - the converter turned it once)
//   N grey  = north  (the opposite of Z)
// A positive end is drawn with its letter; the negative end is a short, pale stub. Axes that point away from the viewer are drawn thinner and paler.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

export interface GizmoAxis {
  key: 'X' | 'Y' | 'Z' | 'N';
  label: string;
  color: string;
  /** end of the positive arm, in the unit circle of the gizmo (x right, y DOWN as on the screen) */
  x: number;
  y: number;
  /** -1 (away from the viewer) .. 1 (towards the viewer) */
  depth: number;
}

const COLORS = { X: '#e5484d', Y: '#30a46c', Z: '#3e63dd', N: '#8b8d98' };

/** the screen position of the scene axes for a camera that looks from (yaw, pitch) at its target (same convention as bimCamera.orbitPosition) */
export function axisGizmoAxes(yaw: number, pitch: number): GizmoAxis[] {
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = [-Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), -Math.sin(pitch) * Math.cos(yaw)];
  // the camera sits at +(cp sin yaw, sin pitch, cp cos yaw): the direction TO the viewer
  const toViewer = [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const mk = (key: GizmoAxis['key'], label: string, v: number[]): GizmoAxis => ({ key, label, color: COLORS[key], x: dot(v, right), y: -dot(v, up), depth: dot(v, toViewer) });
  return [mk('X', 'X', [1, 0, 0]), mk('Y', 'Y up', [0, 1, 0]), mk('Z', 'Z', [0, 0, 1]), mk('N', 'N', [0, 0, -1])];
}

export default function BimAxisGizmo({ yaw, pitch, size = 96, testID }: { yaw: number; pitch: number; size?: number; testID?: string }) {
  const c = size / 2;
  const arm = size * 0.34;
  // the far axes first, so the near ones are drawn over them
  const axes = axisGizmoAxes(yaw, pitch).sort((a, b) => a.depth - b.depth);
  return (
    <View pointerEvents="none" testID={testID} style={[styles.box, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={size * 0.47} fill="#ffffff" fillOpacity={0.55} stroke="#9aa0a6" strokeOpacity={0.5} strokeWidth={1} />
        {axes.map((a) => {
          const near = a.depth >= 0;
          const isNorth = a.key === 'N';
          const ex = c + a.x * arm;
          const ey = c + a.y * arm;
          const lx = c + a.x * (arm + 11);
          const ly = c + a.y * (arm + 11);
          return (
            <React.Fragment key={a.key}>
              {!isNorth ? <Line x1={c} y1={c} x2={c - a.x * arm * 0.35} y2={c - a.y * arm * 0.35} stroke={a.color} strokeOpacity={0.3} strokeWidth={1.5} /> : null}
              <Line x1={c} y1={c} x2={ex} y2={ey} stroke={a.color} strokeOpacity={near ? 1 : 0.45} strokeWidth={isNorth ? 1.5 : near ? 3 : 2} strokeDasharray={isNorth ? '3,3' : undefined} strokeLinecap="round" />
              <Circle cx={ex} cy={ey} r={isNorth ? 2 : near ? 4 : 3} fill={a.color} fillOpacity={near ? 1 : 0.5} />
              <SvgText x={lx} y={ly + 4} fontSize={isNorth ? 9 : 11} fontWeight="700" fill={a.color} fillOpacity={near ? 1 : 0.6} textAnchor="middle">
                {a.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ box: { position: 'absolute', left: 8, bottom: 8 } });
