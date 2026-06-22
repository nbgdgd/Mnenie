import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';

// Горизонтальная полоса распределения позиций.
export function StanceBar({
  believe,
  disbelieve,
  undecided,
}: {
  believe: number;
  disbelieve: number;
  undecided: number;
}) {
  return (
    <View style={s.stancebar}>
      <View style={{ width: `${believe}%`, backgroundColor: COLORS.believe }} />
      <View style={{ width: `${undecided}%`, backgroundColor: COLORS.undecided }} />
      <View style={{ width: `${disbelieve}%`, backgroundColor: COLORS.disbelieve }} />
    </View>
  );
}

export function Badge({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'muted' }) {
  const bg = tone === 'warn' ? '#f59e0b22' : tone === 'muted' ? COLORS.panel2 : '#1d4ed822';
  const fg = tone === 'warn' ? COLORS.warn : tone === 'muted' ? COLORS.muted : COLORS.accent;
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View style={s.panel}>
      <View style={s.panelHead}>
        <Text style={s.panelTitle}>{title}</Text>
        {!!subtitle && <Text style={s.panelSub}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

export function Metric({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={s.metric}>
      <Text style={[s.metricValue, color ? { color } : null]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  stancebar: { flexDirection: 'row', height: 8, borderRadius: 6, overflow: 'hidden', backgroundColor: COLORS.panel2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  panel: { backgroundColor: COLORS.panel, borderColor: COLORS.border, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
  panelHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  panelTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  panelSub: { color: COLORS.muted, fontSize: 12 },
  metric: { backgroundColor: COLORS.panel2, borderRadius: 10, padding: 12, alignItems: 'center', minWidth: 92, flexGrow: 1 },
  metricValue: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  metricLabel: { color: COLORS.muted, fontSize: 11, marginTop: 2, textAlign: 'center' },
});
