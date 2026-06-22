import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';

export interface Bar { label: string; value: number; }

// Простой горизонтальный bar-chart на View (без SVG) — для эмоций.
export function BarChart({ bars, color = COLORS.trust }: { bars: Bar[]; color?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <View style={styles.wrap}>
      {bars.map((b) => (
        <View key={b.label} style={styles.row}>
          <Text style={styles.label}>{b.label}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(b.value / max) * 100}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.value}>{b.value}%</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: COLORS.muted, fontSize: 12, width: 84 },
  track: { flex: 1, height: 12, backgroundColor: COLORS.panel2, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  value: { color: COLORS.text, fontSize: 12, width: 36, textAlign: 'right' },
});
