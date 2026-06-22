import { StyleSheet, Text, View } from 'react-native';
import { COLORS, heatColor } from '../theme';

// Тепловая карта контроверсивности по временным корзинам (старые → новые).
export function Heatmap({ cells }: { cells: number[] }) {
  if (!cells || cells.length === 0) {
    return <Text style={styles.empty}>Недостаточно данных для карты.</Text>;
  }
  return (
    <View>
      <View style={styles.row}>
        {cells.map((v, i) => (
          <View key={i} style={[styles.cell, { backgroundColor: heatColor(v) }]}>
            <Text style={styles.cellText}>{v > 0 ? v : ''}</Text>
          </View>
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>раньше</Text>
        <Text style={styles.axisText}>позже</Text>
      </View>
      <View style={styles.legend}>
        {[
          { c: '#1e3a5f', t: 'низкая' },
          { c: '#3b82f6', t: 'умерен.' },
          { c: '#f59e0b', t: 'высокая' },
          { c: '#ef4444', t: 'острая' },
        ].map((l) => (
          <View key={l.t} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: l.c }]} />
            <Text style={styles.legendText}>{l.t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  cell: { flex: 1, height: 34, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  cellText: { color: '#0b1120', fontSize: 9, fontWeight: '700' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisText: { color: COLORS.muted, fontSize: 10 },
  legend: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 9, height: 9, borderRadius: 2 },
  legendText: { color: COLORS.muted, fontSize: 11 },
  empty: { color: COLORS.muted, fontSize: 13 },
});
