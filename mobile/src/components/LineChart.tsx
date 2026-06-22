import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { COLORS } from '../theme';

export interface Series {
  color: string;
  name: string;
  values: number[];
  forecastFrom?: number; // индекс, с которого данные прогнозные (пунктир)
}

// Лёгкий линейный график на SVG. Ось Y фиксирована 0..100.
export function LineChart({
  series,
  width = 320,
  height = 200,
}: {
  series: Series[];
  width?: number;
  height?: number;
}) {
  const padL = 28, padB = 22, padT = 10, padR = 10;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const n = Math.max(1, ...series.map((s) => s.values.length));
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * w);
  const y = (v: number) => padT + h - (Math.max(0, Math.min(100, v)) / 100) * h;

  const pathFor = (vals: number[], from: number, to: number) => {
    let d = '';
    for (let i = from; i <= to; i++) {
      if (i < 0 || i >= vals.length) continue;
      d += `${i === from ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(vals[i]).toFixed(1)} `;
    }
    return d;
  };

  return (
    <View>
      <Svg width={width} height={height}>
        {[0, 25, 50, 75, 100].map((g) => (
          <Line key={g} x1={padL} y1={y(g)} x2={width - padR} y2={y(g)} stroke={COLORS.border} strokeWidth={1} />
        ))}
        {series.map((s) => {
          const split = s.forecastFrom ?? s.values.length;
          return (
            <Path
              key={`${s.name}-solid`}
              d={pathFor(s.values, 0, Math.min(split, s.values.length - 1))}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
            />
          );
        })}
        {series.map((s) =>
          s.forecastFrom !== undefined ? (
            <Path
              key={`${s.name}-dash`}
              d={pathFor(s.values, s.forecastFrom - 1, s.values.length - 1)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray="5 4"
            />
          ) : null,
        )}
        {series.map((s) =>
          s.values.map((v, i) => (
            <Circle key={`${s.name}-${i}`} cx={x(i)} cy={y(v)} r={2.5} fill={s.color} />
          )),
        )}
      </Svg>
      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.name} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 16, marginTop: 6, flexWrap: 'wrap' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: COLORS.muted, fontSize: 12 },
});
