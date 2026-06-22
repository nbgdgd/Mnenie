import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { Badge, Section, StanceBar } from '../components/common';
import { COLORS, trustColor } from '../theme';
import type { NewsCard } from '../types';

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

  useEffect(() => {
    api.controversial().then(setControversial).catch(() => {});
    api.polarized().then(setPolarized).catch(() => {});
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 14 }}>
      <Section title="🔥 Самые спорные" subtitle="по уровню поляризации общества">
        <RankList items={controversial} metric="polarization" navigation={navigation} />
      </Section>
      <Section title="🤖 Поляризация и кампании" subtitle="с поправкой на координацию">
        <RankList items={polarized} metric="bots" navigation={navigation} />
      </Section>
    </ScrollView>
  );
}

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
