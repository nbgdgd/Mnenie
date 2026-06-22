import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { trustColor } from '../theme';

// Полукруглый индикатор доверия (0..100) на SVG.
function polar(cx: number, cy: number, r: number, valuePct: number) {
  const angle = Math.PI * (1 - valuePct / 100); // 180°..0°
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
}

export function Gauge({ value, label }: { value: number; label?: string }) {
  const cx = 90, cy = 90, r = 70;
  const end = polar(cx, cy, r, Math.max(0, Math.min(100, value)));
  const color = trustColor(value);
  const largeArc = value > 50 ? 1 : 0;
  return (
    <View style={styles.wrap}>
      <Svg viewBox="0 0 180 110" width={180} height={110}>
        <Path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="#1e293b" strokeWidth={14} />
        <Path
          d={`M20 90 A70 70 0 ${largeArc} 1 ${end.x} ${end.y}`}
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
        />
        <SvgText x={90} y={82} fontSize={32} fontWeight="bold" fill={color} textAnchor="middle">
          {String(value)}
        </SvgText>
      </Svg>
      {!!label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  label: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
});
