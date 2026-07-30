import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import catalog from '../../assets/apps.json';
import { Badge, Metric, Section } from '../components/common';
import { COLORS } from '../theme';
import type { AppItem, AppsCatalog, AppVerdict } from '../types';

const CAT = catalog as unknown as AppsCatalog;

const VERDICT: Record<AppVerdict, { label: string; color: string }> = {
  excellent: { label: 'Отличное', color: COLORS.believe },
  good: { label: 'Хорошее', color: COLORS.accent },
  has_issues: { label: 'Есть вопросы', color: COLORS.warn },
  avoid: { label: 'Лучше избегать', color: COLORS.disbelieve },
};

type Filter = 'mine' | 'replace' | 'all' | string;

function AppCard({
  app,
  mine,
  onToggleMine,
}: {
  app: AppItem;
  mine: boolean;
  onToggleMine: () => void;
}) {
  const v = VERDICT[app.verdict];
  const hasAlt = !!app.alternative;
  return (
    <View style={[styles.card, mine && styles.cardMine]}>
      <View style={styles.head}>
        <Text style={styles.emoji}>{app.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{app.name}</Text>
          <Text style={styles.cat}>{app.category}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={[styles.score, { color: v.color }]}>{app.score}</Text>
          <View style={[styles.vBadge, { backgroundColor: v.color + '22' }]}>
            <Text style={[styles.vText, { color: v.color }]}>{v.label}</Text>
          </View>
        </View>
      </View>

      <View style={styles.prosCons}>
        {app.pros.slice(0, 2).map((p) => (
          <Text key={p} style={styles.pro}>＋ {p}</Text>
        ))}
        {app.cons.slice(0, 2).map((c) => (
          <Text key={c} style={styles.con}>－ {c}</Text>
        ))}
      </View>

      {hasAlt && (
        <View style={styles.alt}>
          <Text style={styles.altTitle}>⬆️ Лучше: {app.alternative!.name}</Text>
          <Text style={styles.altReason}>{app.alternative!.reason}</Text>
        </View>
      )}

      <Pressable onPress={onToggleMine} style={[styles.mineBtn, mine && styles.mineBtnActive]}>
        <Text style={[styles.mineText, mine && styles.mineTextActive]}>
          {mine ? '★ У меня стоит' : '☆ Отметить «у меня стоит»'}
        </Text>
      </Pressable>
    </View>
  );
}

export default function AppsScreen() {
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');

  const toggleMine = (id: string) =>
    setMine((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const apps = CAT.apps;
  const replaceable = apps.filter((a) => a.alternative);
  const mineReplace = replaceable.filter((a) => mine.has(a.id));

  const filtered = useMemo(() => {
    let list = apps;
    if (filter === 'mine') list = apps.filter((a) => mine.has(a.id));
    else if (filter === 'replace') list = replaceable;
    else if (filter !== 'all') list = apps.filter((a) => a.category === filter);
    // приоритет: сначала «мои», потом кого стоит заменить, потом по оценке
    return [...list].sort((a, b) => {
      const am = mine.has(a.id) ? 1 : 0;
      const bm = mine.has(b.id) ? 1 : 0;
      if (am !== bm) return bm - am;
      return b.score - a.score;
    });
  }, [apps, filter, mine, replaceable]);

  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Все' },
    { key: 'mine', label: `Мои (${mine.size})` },
    { key: 'replace', label: 'Можно улучшить' },
    ...CAT.categories.map((c) => ({ key: c, label: c })),
  ];

  const header = (
    <View>
      <Section title="📱 Программы" subtitle="анализ приложений и подсказка лучшего аналога">
        <View style={styles.tiles}>
          <Metric label="Проанализировано" value={apps.length} color={COLORS.accent} />
          <Metric label="Можно заменить" value={replaceable.length} color={COLORS.warn} />
          <Metric label="Твоих к замене" value={mineReplace.length} color={COLORS.disbelieve} />
        </View>
        <Text style={styles.hint}>
          Отметь приложения «у меня стоит» — и фильтр «Мои» покажет твой список с оценками и что
          из этого стоит заменить на лучший аналог. Скажи свой список — вшью его заранее.
        </Text>
      </Section>

      {mineReplace.length > 0 && filter !== 'replace' && (
        <View style={styles.suggestBox}>
          <Text style={styles.suggestTitle}>💡 У тебя есть что улучшить</Text>
          {mineReplace.slice(0, 4).map((a) => (
            <Text key={a.id} style={styles.suggestRow}>
              {a.emoji} {a.name} → <Text style={styles.suggestAlt}>{a.alternative!.name}</Text>
            </Text>
          ))}
        </View>
      )}

      <View style={styles.filterRow}>
        {chips.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => setFilter(c.key)}
            style={[styles.chip, filter === c.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === c.key && styles.chipTextActive]}>{c.label}</Text>
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
      keyExtractor={(a) => a.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <AppCard app={item} mine={mine.has(item.id)} onToggleMine={() => toggleMine(item.id)} />
      )}
      ListEmptyComponent={<Text style={styles.empty}>Пусто. Отметь приложения «у меня стоит».</Text>}
      initialNumToRender={10}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 14, paddingBottom: 32 },
  tiles: { flexDirection: 'row', gap: 10 },
  hint: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 12 },
  suggestBox: { backgroundColor: '#f59e0b11', borderColor: '#f59e0b33', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  suggestTitle: { color: COLORS.warn, fontWeight: '700', fontSize: 14, marginBottom: 6 },
  suggestRow: { color: COLORS.text, fontSize: 13, lineHeight: 20 },
  suggestAlt: { color: COLORS.believe, fontWeight: '700' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { backgroundColor: COLORS.panel, borderColor: COLORS.border, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#1d4ed822', borderColor: COLORS.accent },
  chipText: { color: COLORS.muted, fontSize: 13 },
  chipTextActive: { color: COLORS.accent },
  card: { backgroundColor: COLORS.panel, borderColor: COLORS.border, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  cardMine: { borderColor: COLORS.accent },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 32 },
  name: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  cat: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  scoreBox: { alignItems: 'flex-end', gap: 4 },
  score: { fontSize: 22, fontWeight: '800' },
  vBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  vText: { fontSize: 11, fontWeight: '700' },
  prosCons: { marginTop: 10, gap: 3 },
  pro: { color: COLORS.believe, fontSize: 13, lineHeight: 18 },
  con: { color: COLORS.disbelieve, fontSize: 13, lineHeight: 18 },
  alt: { marginTop: 10, backgroundColor: '#34d39911', borderLeftColor: COLORS.believe, borderLeftWidth: 3, borderRadius: 8, padding: 10 },
  altTitle: { color: COLORS.believe, fontSize: 14, fontWeight: '700' },
  altReason: { color: COLORS.muted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  mineBtn: { marginTop: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 8, alignItems: 'center' },
  mineBtnActive: { backgroundColor: '#1d4ed822', borderColor: COLORS.accent },
  mineText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  mineTextActive: { color: COLORS.accent },
  empty: { color: COLORS.muted, fontSize: 13, textAlign: 'center', marginTop: 20 },
});
