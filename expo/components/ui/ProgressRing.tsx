import React from 'react';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import Colors from '@/constants/colors';

interface Props {
  percent: number;
  size?: number;
  strokeWidth?: number;
  useGradient?: boolean;
  color?: string;
  trackColor?: string;
}

/**
 * ProgressRing — circular progress indicator.
 *
 * Defaults to 220px with the gold gradient stroke.
 * Pass size=26, strokeWidth=3, useGradient=false for mini stat-card rings.
 */
export default function ProgressRing({
  percent,
  size = 220,
  strokeWidth = 12,
  useGradient = true,
  color,
  trackColor,
}: Props) {
  const r    = (size - strokeWidth) / 2;
  const cx   = size / 2;
  const cy   = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * circ;
  const gradId = `goldGrad_${size}_${strokeWidth}`;

  return (
    <Svg width={size} height={size}>
      {useGradient && (
        <Defs>
          <SvgLinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#E7C76D" />
            <Stop offset="55%"  stopColor="#C9A24A" />
            <Stop offset="100%" stopColor="#8A6A28" />
          </SvgLinearGradient>
        </Defs>
      )}
      {/* Track */}
      <Circle
        cx={cx} cy={cy} r={r}
        stroke={trackColor ?? 'rgba(255,255,255,0.10)'}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Fill */}
      <Circle
        cx={cx} cy={cy} r={r}
        stroke={useGradient ? `url(#${gradId})` : (color ?? Colors.primary)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${filled} ${circ}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </Svg>
  );
}
