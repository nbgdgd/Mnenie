import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { BarChart } from '../components/BarChart';
import { Donut } from '../components/Donut';
import { Gauge } from '../components/Gauge';
import { LineChart, type Series } from '../components/LineChart';
import { Badge, Metric, Section, StanceBar } from '../components/common';
import { COLORS, EMOTION_LABELS } from '../theme';
import type { NewsAnalysis } from '../types';

export default function DetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { id } = route.params as { id: string };
  const [data, setData] = useState<NewsAnalysis | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.news(id).then(setData).catch(() => setError(true));
  }, [id]);

  if (error) return <View style={styles.center}><Text style={styles.muted}>Не удалось загрузить новость.</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator color={COLORS.accent} /></View>;

  const { news, sources, metrics, verdict, timeline, geo, campaign, clusters } = data;

  const stanceSlices = [
    { label: 'Верят', value: metrics.believePct, color: COLORS.believe },
    { label: 'Не определились', value: metrics.undecidedPct, color: COLORS.undecided },
    { label: 'Не верят', value: metrics.disbelievePct, color: COLORS.disbelieve },
  ];

  const forecastFrom = timeline.findIndex((s) => s.forecast);
  const series: Series[] = [
    {
      name: 'Верят, %',
      color: COLORS.believe,
      values: timeline.map((s) => s.believePct),
      forecastFrom: forecastFrom >= 0 ? forecastFrom : undefined,
    },
    {
      name: 'Индекс доверия',
      color: COLORS.trust,
      values: timeline.map((s) => s.trustIndex),
      forecastFrom: forecastFrom >= 0 ? forecastFrom : undefined,
    },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.badges}>
        <Badge tone="muted">{news.topic}</Badge>
        <Badge tone="muted">{news.country}</Badge>
        {campaign.detected && <Badge tone="warn">⚠ обнаружена кампания</Badge>}
      </View>
      <Text style={styles.title}>{news.title}</Text>
      <Text style={styles.summary}>{news.summary}</Text>
      <Text style={styles.sources}>Источники: {sources.map((s) => s.name).join(', ')}</Text>

      <Pressable
        style={styles.commentsBtn}
        onPress={() => navigation.navigate('Comments', { id, title: news.title })}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.commentsBtnTitle}>🗣 Анализ комментариев</Text>
          <Text style={styles.commentsBtnSub}>
            {metrics.sampleSize} реакций · мнения, кластеры, выявление влияния
          </Text>
        </View>
        <Text style={styles.commentsBtnArrow}>→</Text>
      </Pressable>

      <Section title="Индекс доверия">
        <View style={{ alignItems: 'center' }}>
          <Gauge value={metrics.trustIndex} label={`выборка: ${metrics.sampleSize} реакций`} />
        </View>
      </Section>

      <Section title="Распределение позиций" subtitle="взвешено по достоверности">
        <Donut slices={stanceSlices} />
      </Section>

      <Section title="Показатели">
        <View style={styles.metricGrid}>
          <Metric label="Верят" value={`${metrics.believePct}%`} color={COLORS.believe} />
          <Metric label="Не верят" value={`${metrics.disbelievePct}%`} color={COLORS.disbelieve} />
          <Metric label="Не определились" value={`${metrics.undecidedPct}%`} color={COLORS.undecided} />
          <Metric label="Поляризация" value={metrics.polarization} />
          <Metric label="P(правда)" value={`${metrics.truthProbability}%`} color={COLORS.trust} />
          <Metric label="Доля ботов" value={`${Math.round(metrics.botRatio * 100)}%`} color={COLORS.warn} />
        </View>
      </Section>

      <Section title="⚖ Суд общества" subtitle={`уверенность ${Math.round(verdict.confidence * 100)}%`}>
        <Text style={styles.verdictLabel}>Вероятный вердикт</Text>
        <Text style={styles.verdictValue}>{verdict.verdict}</Text>
        <StanceBar believe={metrics.believePct} disbelieve={metrics.disbelievePct} undecided={metrics.undecidedPct} />
        <View style={styles.breakdown}>
          <Text style={styles.bkRow}>Поддерживают: <Text style={styles.bkVal}>{verdict.breakdown.support}%</Text></Text>
          <Text style={styles.bkRow}>Осуждают: <Text style={styles.bkVal}>{verdict.breakdown.condemn}%</Text></Text>
          <Text style={styles.bkRow}>Считают правдой: <Text style={styles.bkVal}>{verdict.breakdown.truth}%</Text></Text>
          <Text style={styles.bkRow}>Считают фейком: <Text style={styles.bkVal}>{verdict.breakdown.fake}%</Text></Text>
        </View>
        <Text style={styles.argHead}>Аргументы большинства</Text>
        {verdict.majorityArguments.length === 0 && <Text style={styles.muted}>—</Text>}
        {verdict.majorityArguments.map((a) => (
          <View key={a.id} style={styles.arg}>
            <Text style={styles.argLabel}>{a.label} · {a.size}</Text>
            <Text style={styles.argText}>«{a.representativeText}»</Text>
          </View>
        ))}
        <Text style={styles.argHead}>Аргументы меньшинства</Text>
        {verdict.minorityArguments.length === 0 && <Text style={styles.muted}>—</Text>}
        {verdict.minorityArguments.map((a) => (
          <View key={a.id} style={styles.arg}>
            <Text style={styles.argLabel}>{a.label} · {a.size}</Text>
            <Text style={styles.argText}>«{a.representativeText}»</Text>
          </View>
        ))}
      </Section>

      <Section title="Динамика мнения" subtitle="пунктир — прогноз модели">
        <LineChart series={series} />
      </Section>

      <Section title="Эмоциональная реакция">
        <BarChart bars={metrics.emotions.map((e) => ({ label: EMOTION_LABELS[e.emotion] ?? e.emotion, value: e.pct }))} />
      </Section>

      <Section title="Карта распространения мнений" subtitle="по странам источников">
        {geo.map((g) => (
          <View key={g.country} style={styles.geoRow}>
            <Text style={styles.geoCountry}>{g.country}</Text>
            <View style={styles.geoBar}>
              <View style={{ width: `${g.believePct}%`, backgroundColor: COLORS.believe }} />
              <View style={{ width: `${g.disbelievePct}%`, backgroundColor: COLORS.disbelieve }} />
            </View>
            <Text style={styles.geoVol}>{g.volume}</Text>
          </View>
        ))}
      </Section>

      <Section title="Кластеры аргументов">
        {clusters.slice(0, 8).map((c) => (
          <View key={c.id} style={[styles.cluster, { borderLeftColor: c.side === 'believe' ? COLORS.believe : COLORS.disbelieve }]}>
            <Text style={styles.clusterHead}>{c.label} · {c.size}</Text>
            <Text style={styles.clusterText}>«{c.representativeText}»</Text>
          </View>
        ))}
      </Section>

      <Section title="Источники и достоверность">
        {sources.map((sx) => (
          <View key={sx.id} style={styles.srcRow}>
            <Text style={styles.srcName}>{sx.name}</Text>
            <Text style={styles.srcType}>{sx.type}</Text>
            <View style={styles.relBar}>
              <View style={{ width: `${sx.reliabilityScore * 100}%`, backgroundColor: COLORS.accent, height: '100%' }} />
            </View>
            <Text style={styles.srcRel}>{Math.round(sx.reliabilityScore * 100)}%</Text>
          </View>
        ))}
        {campaign.detected && (
          <View style={styles.campaign}>
            <Text style={styles.campaignTitle}>⚠ Признаки информационной кампании</Text>
            <View style={styles.campaignKinds}>
              {campaign.kinds.map((k) => <Badge key={k} tone="warn">{k}</Badge>)}
            </View>
            {campaign.evidence.map((e) => <Text key={e} style={styles.evidence}>• {e}</Text>)}
          </View>
        )}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 14, paddingBottom: 32 },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '700', lineHeight: 28 },
  summary: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  sources: { color: COLORS.muted, fontSize: 12, marginTop: 10, marginBottom: 14 },
  commentsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1d4ed822', borderColor: COLORS.accent, borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 14,
  },
  commentsBtnTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  commentsBtnSub: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  commentsBtnArrow: { color: COLORS.accent, fontSize: 22, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  verdictLabel: { color: COLORS.muted, fontSize: 13 },
  verdictValue: { color: COLORS.accent, fontSize: 24, fontWeight: '700', marginVertical: 6 },
  breakdown: { marginTop: 12, gap: 4 },
  bkRow: { color: COLORS.muted, fontSize: 13 },
  bkVal: { color: COLORS.text, fontWeight: '700' },
  argHead: { color: COLORS.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  arg: { backgroundColor: COLORS.panel2, borderRadius: 10, padding: 10, marginBottom: 8 },
  argLabel: { color: COLORS.accent, fontSize: 12, marginBottom: 4 },
  argText: { color: COLORS.text, fontSize: 13, lineHeight: 18 },
  muted: { color: COLORS.muted, fontSize: 13 },
  geoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  geoCountry: { color: COLORS.muted, fontSize: 13, width: 44 },
  geoBar: { flex: 1, flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: COLORS.panel2 },
  geoVol: { color: COLORS.muted, fontSize: 12, width: 30, textAlign: 'right' },
  cluster: { backgroundColor: COLORS.panel2, borderLeftWidth: 3, borderRadius: 8, padding: 10, marginBottom: 8 },
  clusterHead: { color: COLORS.text, fontSize: 13, marginBottom: 4 },
  clusterText: { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  srcRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  srcName: { color: COLORS.text, fontSize: 13, flex: 1 },
  srcType: { color: COLORS.muted, fontSize: 12, width: 50 },
  relBar: { width: 70, height: 6, backgroundColor: COLORS.panel2, borderRadius: 4, overflow: 'hidden' },
  srcRel: { color: COLORS.muted, fontSize: 12, width: 36, textAlign: 'right' },
  campaign: { marginTop: 14, backgroundColor: '#f59e0b11', borderColor: '#f59e0b33', borderWidth: 1, borderRadius: 12, padding: 12 },
  campaignTitle: { color: COLORS.warn, fontWeight: '600', fontSize: 14 },
  campaignKinds: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginVertical: 8 },
  evidence: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
});
