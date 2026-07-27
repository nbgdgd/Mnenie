import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { Badge, Metric, Section, StanceBar } from '../components/common';
import { COLORS, trustColor } from '../theme';
import type { NewsCard, Stats } from '../types';

function StatsPanel({ stats }: { stats: Stats }) {
  const maxSrc = Math.max(1, ...stats.bySource.map((s) => s.comments));
  return (
    <Section title="📊 Статистика платформы" subtitle={`обновлено из ${stats.totalSources} источников`}>
      <View style={pstyles.grid}>
        <Metric label="Новостей" value={stats.totalNews} color={COLORS.accent} />
        <Metric label="Комментариев" value={stats.totalComments} color={COLORS.accent} />
        <Metric label="Источников" value={stats.totalSources} />
        <Metric label="Ср. доверие" value={stats.avgTrustIndex} color={trustColor(stats.avgTrustIndex)} />
        <Metric label="Ср. спорность" value={`${stats.avgControversy}%`} color={COLORS.warn} />
        <Metric label="Ср. боты" value={`${stats.avgBotLikelihood}%`} color={COLORS.warn} />
        <Metric label="Кампаний" value={stats.campaignsDetected} color={COLORS.disbelieve} />
        <Metric label="Сигналов влияния" value={stats.influenceAlerts} color={COLORS.disbelieve} />
        <Metric label="Тем" value={stats.topics} />
      </View>

      <Text style={pstyles.sub}>Комментарии по источникам</Text>
      {stats.bySource.map((s) => (
        <View key={s.id} style={pstyles.srcRow}>
          <Text style={pstyles.srcName}>{s.name}</Text>
          <View style={pstyles.srcBarBg}>
            <View style={[pstyles.srcBar, { width: `${Math.round((s.comments / maxSrc) * 100)}%` }]} />
          </View>
          <Text style={pstyles.srcVal}>{s.comments}</Text>
        </View>
      ))}

      <Text style={pstyles.sub}>Новости по темам</Text>
      <View style={pstyles.chips}>
        {stats.byTopic.map((t) => (
          <View key={t.topic} style={pstyles.topicChip}>
            <Text style={pstyles.topicText}>{t.topic}</Text>
            <Text style={pstyles.topicCount}>{t.news}</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

function RankList({
  items,
  metric,
  navigation,
}: {
  items: NewsCard[];
  metric: 'polarization' | 'bots';
  navigation: any;
}) {
  return (
    <View style={{ gap: 8 }}>
      {items.map((c, i) => (
        <Pressable
          key={c.news.id}
          style={styles.row}
          onPress={() => navigation.navigate('Detail', { id: c.news.id, title: c.news.title })}
        >
          <Text style={styles.num}>{i + 1}</Text>
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>{c.news.title}</Text>
              {c.campaignDetected && <Badge tone="warn">⚠</Badge>}
            </View>
            <StanceBar believe={c.metrics.believePct} disbelieve={c.metrics.disbelievePct} undecided={c.metrics.undecidedPct} />
          </View>
          <View style={styles.score}>
            <Text style={[styles.scoreVal, { color: metric === 'polarization' ? trustColor(100 - c.metrics.polarization) : COLORS.warn }]}>
              {metric === 'polarization' ? c.metrics.polarization : `${Math.round(c.metrics.botRatio * 100)}%`}
            </Text>
            <Text style={styles.scoreLabel}>{metric === 'polarization' ? 'поляр.' : 'боты'}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export default function RankingsScreen({ navigation }: { navigation: any }) {
  const [controversial, setControversial] = useState<NewsCard[]>([]);
  const [polarized, setPolarized] = useState<NewsCard[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.controversial().then(setControversial).catch(() => {});
    api.polarized().then(setPolarized).catch(() => {});
    api.stats().then(setStats).catch(() => {});
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 14 }}>
      {stats && <StatsPanel stats={stats} />}
      <Section title="🔥 Самые спорные" subtitle="по уровню поляризации общества">
        <RankList items={controversial} metric="polarization" navigation={navigation} />
      </Section>
      <Section title="🤖 Поляризация и кампании" subtitle="с поправкой на координацию">
        <RankList items={polarized} metric="bots" navigation={navigation} />
      </Section>
    </ScrollView>
  );
}

const pstyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sub: { color: COLORS.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  srcRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  srcName: { color: COLORS.text, fontSize: 13, width: 96 },
  srcBarBg: { flex: 1, height: 8, backgroundColor: COLORS.panel2, borderRadius: 4, overflow: 'hidden' },
  srcBar: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 4 },
  srcVal: { color: COLORS.muted, fontSize: 12, width: 42, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.panel2, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  topicText: { color: COLORS.text, fontSize: 12 },
  topicCount: { color: COLORS.accent, fontSize: 12, fontWeight: '700' },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.panel2, borderRadius: 10, padding: 12 },
  num: { color: COLORS.muted, fontSize: 18, fontWeight: '700', width: 22, textAlign: 'center' },
  body: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: COLORS.text, fontSize: 14, flex: 1 },
  score: { alignItems: 'center' },
  scoreVal: { fontSize: 18, fontWeight: '700' },
  scoreLabel: { color: COLORS.muted, fontSize: 10 },
});
