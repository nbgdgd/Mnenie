import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { api, type FeedQuery } from '../api';
import { Badge, StanceBar } from '../components/common';
import { COLORS, trustColor } from '../theme';
import type { Filters, NewsCard } from '../types';

const SORTS: { key: NonNullable<FeedQuery['sort']>; label: string }[] = [
  { key: 'recent', label: 'Свежие' },
  { key: 'controversial', label: 'Спорные' },
  { key: 'campaigns', label: 'Кампании' },
  { key: 'trust', label: 'Доверие' },
];

export default function FeedScreen({ navigation }: { navigation: any }) {
  const [cards, setCards] = useState<NewsCard[]>([]);
  const [filters, setFilters] = useState<Filters>({ countries: [], topics: [] });
  const [query, setQuery] = useState<FeedQuery>({ sort: 'recent' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.filters().then(setFilters).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    api
      .feed(query)
      .then((c) => { setCards(c); setError(null); })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.controls}>
        <TextInput
          placeholder="Поиск по новостям…"
          placeholderTextColor={COLORS.muted}
          style={styles.search}
          value={query.q ?? ''}
          onChangeText={(t) => setQuery((q) => ({ ...q, q: t || undefined }))}
        />
        <View style={styles.chipRow}>
          {SORTS.map((sopt) => (
            <Pressable
              key={sopt.key}
              onPress={() => setQuery((q) => ({ ...q, sort: sopt.key }))}
              style={[styles.chip, query.sort === sopt.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, query.sort === sopt.key && styles.chipTextActive]}>{sopt.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => setQuery((q) => ({ ...q, topic: undefined }))}
            style={[styles.chip, !query.topic && styles.chipActive]}
          >
            <Text style={[styles.chipText, !query.topic && styles.chipTextActive]}>Все темы</Text>
          </Pressable>
          {filters.topics.map((t) => (
            <Pressable
              key={t}
              onPress={() => setQuery((q) => ({ ...q, topic: q.topic === t ? undefined : t }))}
              style={[styles.chip, query.topic === t && styles.chipActive]}
            >
              <Text style={[styles.chipText, query.topic === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.error}>Нет связи с backend.</Text>
          <Text style={styles.muted}>{error}</Text>
          <Text style={styles.muted}>Проверьте, что сервер запущен и адрес API верный (app.json → extra.apiBase).</Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(c) => c.news.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.accent} />}
          ListEmptyComponent={loading ? <ActivityIndicator color={COLORS.accent} style={{ marginTop: 40 }} /> : null}
          renderItem={({ item: c }) => (
            <Pressable style={styles.card} onPress={() => navigation.navigate('Detail', { id: c.news.id, title: c.news.title })}>
              <View style={styles.cardTop}>
                <Badge tone="muted">{c.news.topic}</Badge>
                <Badge tone="muted">{c.news.country}</Badge>
                {c.campaignDetected && <Badge tone="warn">⚠ кампания</Badge>}
              </View>
              <Text style={styles.title}>{c.news.title}</Text>
              <Text style={styles.summary} numberOfLines={3}>{c.news.summary}</Text>
              <View style={styles.metaRow}>
                <View style={[styles.trustPill, { borderColor: trustColor(c.metrics.trustIndex) }]}>
                  <Text style={[styles.trustValue, { color: trustColor(c.metrics.trustIndex) }]}>{c.metrics.trustIndex}</Text>
                  <Text style={styles.trustLabel}>доверие</Text>
                </View>
                <Text style={styles.tag}>поляризация {c.metrics.polarization}</Text>
                <Text style={styles.tag}>P(правда) {c.metrics.truthProbability}%</Text>
              </View>
              <StanceBar believe={c.metrics.believePct} disbelieve={c.metrics.disbelievePct} undecided={c.metrics.undecidedPct} />
              <View style={styles.legend}>
                <Text style={styles.legendText}>верят {c.metrics.believePct}%</Text>
                <Text style={styles.legendText}>не опр. {c.metrics.undecidedPct}%</Text>
                <Text style={styles.legendText}>не верят {c.metrics.disbelievePct}%</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  controls: { padding: 14, gap: 10 },
  search: {
    backgroundColor: COLORS.panel, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 10, color: COLORS.text, paddingHorizontal: 12, paddingVertical: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: COLORS.panel, borderColor: COLORS.border, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#1d4ed822', borderColor: COLORS.accent },
  chipText: { color: COLORS.muted, fontSize: 13 },
  chipTextActive: { color: COLORS.accent },
  list: { paddingHorizontal: 14, paddingBottom: 24, gap: 14 },
  card: { backgroundColor: COLORS.panel, borderColor: COLORS.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  cardTop: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  title: { color: COLORS.text, fontSize: 17, fontWeight: '700', lineHeight: 22 },
  summary: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  trustPill: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, alignItems: 'center' },
  trustValue: { fontSize: 18, fontWeight: '700' },
  trustLabel: { color: COLORS.muted, fontSize: 10 },
  tag: { color: COLORS.muted, fontSize: 12, backgroundColor: COLORS.panel2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendText: { color: COLORS.muted, fontSize: 11 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  error: { color: COLORS.disbelieve, fontSize: 16, fontWeight: '600' },
  muted: { color: COLORS.muted, fontSize: 13, textAlign: 'center' },
});
