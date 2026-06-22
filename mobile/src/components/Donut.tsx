import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { COLORS } from '../theme';

interface Slice { label: string; value: number; color: string; }

// Кольцевая диаграмма распределения позиций (через stroke-dasharray).
export function Donut({ slices, size = 160 }: { slices: Slice[]; size?: number }) {
  const r = size / 2 - 16;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;

  return (
    <View style={styles.row}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          {slices.map((s) => {
            const len = (s.value / total) * circ;
            const el = (
              <Circle
                key={s.label}
                cx={cx}
                cy={cy}
                r={r}
                stroke={s.color}
                strokeWidth={20}
                fill="none"
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </G>
      </Svg>
      <View style={styles.legend}>
        {slices.map((s) => (
          <View key={s.label} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>
              {s.label} — {s.value}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  legend: { gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: COLORS.text, fontSize: 13 },
});
