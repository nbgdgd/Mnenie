import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { Donut } from '../components/Donut';
import { Heatmap } from '../components/Heatmap';
import { Badge, Metric, Section } from '../components/common';
import {
  COLORS, FLAG_COLOR, FLAG_LABEL, SENTIMENT_COLOR, SENTIMENT_LABEL, trustColor,
} from '../theme';
import type { CommentDetail, CommentsAnalytics } from '../types';

type Filter = 'all' | 'support' | 'against' | 'controversial' | 'suspicious' | 'minority';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'support', label: 'Поддержка' },
  { key: 'against', label: 'Против' },
  { key: 'controversial', label: 'Противоречивые' },
  { key: 'suspicious', label: 'Подозрительные' },
  { key: 'minority', label: 'Меньшинство' },
];

function applyFilter(comments: CommentDetail[], f: Filter): CommentDetail[] {
  switch (f) {
    case 'support': return comments.filter((c) => c.sentiment === 'support');
    case 'against': return comments.filter((c) => c.sentiment === 'against');
    case 'controversial': return comments.filter((c) => c.controversyScore >= 60);
    case 'suspicious': return comments.filter((c) => c.cluster === 'suspicious');
    case 'minority': return comments.filter((c) => c.cluster === 'minority');
    default: return comments;
  }
}

// Трёхсегментная полоса поддержка / против / нейтрально.
function TriBar({ s, a, n }: { s: number; a: number; n: number }) {
  return (
    <View style={styles.tribar}>
      {s > 0 && <View style={{ width: `${s}%`, backgroundColor: COLORS.believe }} />}
      {n > 0 && <View style={{ width: `${n}%`, backgroundColor: COLORS.undecided }} />}
      {a > 0 && <View style={{ width: `${a}%`, backgroundColor: COLORS.disbelieve }} />}
    </View>
  );
}

const SENTIMENT_ICON: Record<string, string> = { support: '👍', against: '👎', neutral: '😐' };

function CommentCard({ c }: { c: CommentDetail }) {
  const controversial = c.controversyScore >= 60;
  const suspicious = c.cluster === 'suspicious';
  const sentColor = SENTIMENT_COLOR[c.sentiment];
  // рамка сверху: подозрительный → warn, противоречивый → red, иначе по тону
  const borderColor = suspicious ? COLORS.warn : controversial ? COLORS.disbelieve : COLORS.border;
  const borderWidth = suspicious || controversial ? 1.5 : 1;
  return (
    <View style={[styles.comment, { borderColor, borderWidth, borderLeftColor: sentColor, borderLeftWidth: 5 }]}>
      {/* СТАТУС — крупная цветная плашка сверху */}
      <View style={styles.cHead}>
        <View style={[styles.statusPill, { backgroundColor: sentColor }]}>
          <Text style={styles.statusPillText}>
            {SENTIMENT_ICON[c.sentiment]} {SENTIMENT_LABEL[c.sentiment].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.cAuthor} numberOfLines={1}>@{c.author}</Text>
      </View>
      <Text style={styles.cText}>{c.text}</Text>
      <View style={styles.markers}>
        <Marker label="спорность" value={c.controversyScore} color={trustColor(100 - c.controversyScore)} />
        <Marker label="боты" value={c.botProbability} suffix="%" color={c.botProbability >= 50 ? COLORS.warn : COLORS.muted} />
        <View style={styles.marker}>
          <Text style={[styles.markerVal, { color: FLAG_COLOR[c.influence] }]}>{FLAG_LABEL[c.influence]}</Text>
          <Text style={styles.markerLabel}>влияние</Text>
        </View>
        {c.likes > 0 && <Marker label="лайки" value={c.likes} color={COLORS.muted} />}
      </View>
      <View style={styles.flags}>
        {controversial && <Badge tone="warn">⚡ противоречивый</Badge>}
        {suspicious && <Badge tone="warn">🤖 подозрительный</Badge>}
        {c.isRepetitive && <Badge tone="muted">🔁 повтор</Badge>}
        {c.cluster === 'minority' && <Badge tone="info">💬 редкое мнение</Badge>}
      </View>
    </View>
  );
}

function Marker({ label, value, color, suffix = '' }: { label: string; value: number; color: string; suffix?: string }) {
  return (
    <View style={styles.marker}>
      <Text style={[styles.markerVal, { color }]}>{value}{suffix}</Text>
      <Text style={styles.markerLabel}>{label}</Text>
    </View>
  );
}

const CLUSTER_COLOR: Record<string, string> = {
  support: COLORS.believe,
  opposition: COLORS.disbelieve,
  neutral: COLORS.undecided,
  minority: COLORS.accent,
  suspicious: COLORS.warn,
};

export default function CommentsScreen({ route }: { route: any }) {
  const { id } = route.params as { id: string };
  const [data, setData] = useState<CommentsAnalytics | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    api.comments(id).then(setData).catch(() => setError(true));
  }, [id]);

  const filtered = useMemo(() => (data ? applyFilter(data.comments, filter) : []), [data, filter]);

  if (error) return <View style={styles.center}><Text style={styles.muted}>Аналитика комментариев недоступна.</Text></View>;
  if (!data) return <View style={styles.center}><ActivityIndicator color={COLORS.accent} /></View>;

  const m = data.summary;
  const inf = data.influence;

  const header = (
    <View>
      <Section title="🗣 COMMENTS ANALYTICS" subtitle={`${m.totalComments} комментариев · прозрачный анализ`}>
        <Text style={styles.barLabel}>Распределение мнений</Text>
        <TriBar s={m.supportPct} a={m.againstPct} n={m.neutralPct} />
        <View style={styles.legend}>
          <Legend color={COLORS.believe} text={`Поддержка ${m.supportPct}%`} />
          <Legend color={COLORS.undecided} text={`Нейтр. ${m.neutralPct}%`} />
          <Legend color={COLORS.disbelieve} text={`Против ${m.againstPct}%`} />
        </View>
        <View style={styles.tiles}>
          <Metric label="Противоречивые" value={`${m.controversialPct}%`} color={COLORS.warn} />
          <Metric label="Бот-вероятность" value={`${m.botLikelihoodPct}%`} color={m.botLikelihoodPct >= 40 ? COLORS.disbelieve : COLORS.muted} />
          <Metric label="Влияние" value={`${m.influenceScorePct}%`} color={FLAG_COLOR[inf.flag]} />
        </View>
      </Section>

      <Section title="Доли мнений" subtitle="support · against · neutral">
        <Donut
          slices={[
            { label: 'Поддержка', value: m.supportPct, color: COLORS.believe },
            { label: 'Нейтрально', value: m.neutralPct, color: COLORS.undecided },
            { label: 'Против', value: m.againstPct, color: COLORS.disbelieve },
          ]}
        />
      </Section>

      <Section title="Карта контроверсивности" subtitle="накал обсуждения во времени">
        <Heatmap cells={data.heatmap} />
      </Section>

      <Section
        title="🛰 INFLUENCE DETECTION"
        subtitle={`координация: ${inf.score}% · ${FLAG_LABEL[inf.flag]}`}
      >
        {inf.signals.length === 0 ? (
          <Text style={styles.muted}>Признаков координации не обнаружено — обсуждение выглядит органическим.</Text>
        ) : (
          inf.signals.map((s) => (
            <View key={s.kind} style={[styles.signal, { borderLeftColor: FLAG_COLOR[s.severity] }]}>
              <View style={styles.signalHead}>
                <Text style={styles.signalLabel}>{s.label}</Text>
                <Text style={[styles.signalSev, { color: FLAG_COLOR[s.severity] }]}>{FLAG_LABEL[s.severity]} · {s.score}</Text>
              </View>
              <Text style={styles.signalDetail}>{s.detail}</Text>
            </View>
          ))
        )}
      </Section>

      <Section title="Кластеры мнений" subtitle="меньшинство сохраняется отдельно">
        {data.clusters.map((cl) => (
          <View key={cl.kind} style={[styles.cluster, { borderLeftColor: CLUSTER_COLOR[cl.kind] }]}>
            <View style={styles.clusterHead}>
              <Text style={styles.clusterLabel}>{cl.label}</Text>
              <Text style={styles.clusterSize}>{cl.size} · {cl.sharePct}%</Text>
            </View>
            {!!cl.representative && <Text style={styles.clusterQuote} numberOfLines={2}>«{cl.representative}»</Text>}
          </View>
        ))}
      </Section>

      <View style={styles.filterTitleRow}>
        <Text style={styles.feedTitle}>Лента комментариев</Text>
        <Text style={styles.feedCount}>{filtered.length}</Text>
      </View>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipActive]}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={filtered}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => <CommentCard c={item} />}
      ListEmptyComponent={<Text style={styles.muted}>Нет комментариев по этому фильтру.</Text>}
      initialNumToRender={12}
      windowSize={10}
    />
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 14, paddingBottom: 32 },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  muted: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  barLabel: { color: COLORS.muted, fontSize: 12, marginBottom: 6 },
  tribar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: COLORS.panel2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: COLORS.text, fontSize: 12 },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 14 },
  signal: { backgroundColor: COLORS.panel2, borderLeftWidth: 3, borderRadius: 8, padding: 10, marginBottom: 8 },
  signalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  signalLabel: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  signalSev: { fontSize: 12, fontWeight: '700' },
  signalDetail: { color: COLORS.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  cluster: { backgroundColor: COLORS.panel2, borderLeftWidth: 3, borderRadius: 8, padding: 10, marginBottom: 8 },
  clusterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clusterLabel: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  clusterSize: { color: COLORS.muted, fontSize: 12 },
  clusterQuote: { color: COLORS.muted, fontSize: 12, marginTop: 4, fontStyle: 'italic', lineHeight: 17 },
  filterTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4, marginBottom: 10 },
  feedTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  feedCount: { color: COLORS.muted, fontSize: 14 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { backgroundColor: COLORS.panel, borderColor: COLORS.border, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#1d4ed822', borderColor: COLORS.accent },
  chipText: { color: COLORS.muted, fontSize: 13 },
  chipTextActive: { color: COLORS.accent },
  comment: { backgroundColor: COLORS.panel, borderRadius: 12, padding: 12, marginBottom: 10 },
  cHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cAuthor: { color: COLORS.muted, fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'right' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusPillText: { fontSize: 12, fontWeight: '800', color: '#0b1120' },
  cText: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  markers: { flexDirection: 'row', gap: 16, marginTop: 10, flexWrap: 'wrap' },
  marker: { alignItems: 'flex-start' },
  markerVal: { fontSize: 15, fontWeight: '700' },
  markerLabel: { color: COLORS.muted, fontSize: 10 },
  flags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
});
