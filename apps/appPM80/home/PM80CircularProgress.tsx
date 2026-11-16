import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

export interface PM80CircularProgressProps {
  size: number;
  strokeWidth: number;
  /** 0 to 100 */
  progress: number;
  trackColor?: string;
  strokeColor?: string;
  gradientColors?: [string, string, string?];
  gradientId?: string;
  /** Start angle in degrees (default -90 = 12 o'clock) */
  startAngle?: number;
}

export const PM80CircularProgress: React.FC<PM80CircularProgressProps> = ({
  size,
  strokeWidth,
  progress,
  trackColor = '#E2E8F0',
  strokeColor = '#6366F1',
  gradientColors,
  gradientId = 'pm80Grad',
  startAngle = -90,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {gradientColors && (
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradientColors[0]} />
            <Stop offset="55%" stopColor={gradientColors[1]} />
            <Stop offset="100%" stopColor={gradientColors[2] || gradientColors[1]} />
          </LinearGradient>
        </Defs>
      )}
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={gradientColors ? `url(#${gradientId})` : strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        fill="none"
        transform={`rotate(${startAngle} ${center} ${center})`}
      />
    </Svg>
  );
};

export default PM80CircularProgress;

