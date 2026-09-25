import { renderWidget, usePlugin, useTracker, WidgetLocation } from '@remnote/plugin-sdk';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../style.css';
import '../index.css';

type Level = 'mastered' | 'steady' | 'difficult' | 'new';
type SortMode = 'difficulty' | 'recent' | 'success';
type Config = { masteredReviews: number; masteredSuccess: number; difficultSuccess: number };
type CardRow = {
  id: string;
  remId: string;
  label: string;
  reviews: number;
  success: number;
  level: Level;
  lastScore: number | null;
};

const DEFAULT_CONFIG: Config = { masteredReviews: 4, masteredSuccess: 0.9, difficultSuccess: 0.65 };
const priority: Record<Level, number> = { new: 0, mastered: 1, steady: 2, difficult: 3 };

const plainText = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(plainText).join('');
  if (typeof value === 'object') return plainText(value.text ?? value.value ?? value.content ?? '');
  return '';
};

/** Recent reviews count more than old reviews, so the map reacts to a change in performance. */
const classify = (history: any[] | undefined, wrongInRow = 0, config = DEFAULT_CONFIG) => {
  const scores = (history ?? []).map((x) => Number(x?.score ?? 0));
  if (!scores.length) return { level: 'new' as Level, success: 0, reviews: 0, lastScore: null };
  const weights = scores.map((_, index) => 1 + index / Math.max(1, scores.length - 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const success = scores.reduce((sum, score, index) => sum + (score > 0 ? weights[index] : 0), 0) / totalWeight;
  const lastScore = scores[scores.length - 1] ?? null;
  let level: Level = 'steady';
  if (wrongInRow >= 2 || success < config.difficultSuccess || lastScore === 0) level = 'difficult';
  else if (success >= config.masteredSuccess && scores.length >= config.masteredReviews) level = 'mastered';
  return { level, success, reviews: scores.length, lastScore };
};

export const CardHeatmap = () => {
  const plugin = usePlugin();
  const context = useTracker(async () => plugin.widget.getWidgetContext<WidgetLocation.DocumentBelowTitle>(), []);
  const config = useTracker(async () => ({
    masteredReviews: await plugin.settings.getSetting<number>('mastered-reviews') ?? DEFAULT_CONFIG.masteredReviews,
    masteredSuccess: (await plugin.settings.getSetting<number>('mastered-success') ?? 90) / 100,
    difficultSuccess: (await plugin.settings.getSetting<number>('difficult-success') ?? 65) / 100,
  }), []);
  const settings = config ?? DEFAULT_CONFIG;
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<'all' | Level>('all');
  const [sort, setSort] = useState<SortMode>('difficulty');
  const originalVisibility = useRef(new Map<string, 'hidden' | 'included' | 'none' | undefined>());

  const rows = useTracker(async () => {
    if (!context?.documentId) return [] as CardRow[];
    const document = await plugin.rem.findOne(context.documentId);
    if (!document) return [] as CardRow[];
    const rems = await document.allRemInDocumentOrPortal();
    const result: CardRow[] = [];
    for (const rem of rems) {
      const remCards = await rem.getCards();
      for (const card of remCards ?? []) {
        const history = (card as any).repetitionHistory ?? (card as any).history;
        const stats = classify(history, card.timesWrongInRow ?? 0, settings);
        result.push({ id: card._id, remId: rem._id, label: plainText(rem.text) || 'Tarjeta sin texto', ...stats });
      }
    }
    return result;
  }, [context?.documentId, refreshKey, settings.masteredReviews, settings.masteredSuccess, settings.difficultSuccess]);
  const cards = rows ?? [];

  // Refresh periodically so the map changes after a study session without reloading the note.
  useEffect(() => {
    const timer = window.setInterval(() => setRefreshKey((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Color the real Rem, but never overwrite a highlight chosen manually by the user.
  useEffect(() => {
    let cancelled = false;
    const applyColors = async () => {
      const levelByRem = new Map<string, Level>();
      for (const row of rows ?? []) {
        const current = levelByRem.get(row.remId);
        if (!current || priority[row.level] > priority[current]) levelByRem.set(row.remId, row.level);
      }
      for (const [remId, level] of levelByRem) {
        if (cancelled || level === 'new') continue;
        const rem = await plugin.rem.findOne(remId);
        if (!rem || cancelled || await rem.getHighlightColor()) continue;
        const color = level === 'difficult' ? 'Red' : level === 'mastered' ? 'Green' : 'Yellow';
        await rem.setHighlightColor(color);
      }
    };
    if (rows?.length) void applyColors();
    return () => { cancelled = true; };
  }, [rows, plugin]);

  // Sincroniza el filtro con la nota: los Rems que no pertenecen al estado
  // seleccionado se ocultan en el contexto de este documento. Al volver a
  // "Todas" se recupera exactamente el estado que tenía cada Rem.
  useEffect(() => {
    const documentId = context?.documentId;
    if (!documentId || !cards.length) return;
    let cancelled = false;
    const applyDocumentFilter = async () => {
      const remIds = [...new Set(cards.map((card) => card.remId))];
      for (const remId of remIds) {
        if (cancelled) return;
        const rem = await plugin.rem.findOne(remId);
        if (!rem) continue;
        if (!originalVisibility.current.has(remId)) {
          originalVisibility.current.set(remId, await rem.getHiddenExplicitlyIncludedState(documentId));
        }
        if (filter === 'all') {
          await rem.setHiddenExplicitlyIncludedState(originalVisibility.current.get(remId) ?? 'none', documentId);
        } else {
          const matching = cards.some((card) => card.remId === remId && card.level === filter);
          await rem.setHiddenExplicitlyIncludedState(matching ? 'included' : 'hidden', documentId);
        }
      }
      if (filter === 'all') originalVisibility.current.clear();
    };
    void applyDocumentFilter();
    return () => { cancelled = true; };
  }, [filter, context?.documentId, cards, plugin]);

  const visible = useMemo(() => {
    const filtered = filter === 'all' ? [...cards] : cards.filter((card) => card.level === filter);
    return filtered.sort((a, b) => sort === 'success' ? a.success - b.success : sort === 'recent' ? Number(b.lastScore ?? -1) - Number(a.lastScore ?? -1) : priority[b.level] - priority[a.level]);
  }, [cards, filter, sort]);
  const counts = useMemo(() => cards.reduce((acc, card) => ({ ...acc, [card.level]: acc[card.level] + 1 }), { mastered: 0, steady: 0, difficult: 0, new: 0 } as Record<Level, number>), [cards]);
  const masteredPercent = cards.length ? Math.round((counts.mastered / cards.length) * 100) : 0;

  const openCard = async (row: CardRow) => {
    const rem = await plugin.rem.findOne(row.remId);
    if (rem) await plugin.window.openRem(rem);
  };

  if (!context) return <div className="ch-loading">Cargando mapa de dominio…</div>;
  if (!cards.length) return <div className="ch-empty">No hay tarjetas en esta nota todavía.</div>;

  return (
    <section className="ch-card" aria-label="Mapa visual de dificultad de tarjetas">
      <div className="ch-header">
        <div><div className="ch-title">Mapa de dominio</div><div className="ch-subtitle">{cards.length} tarjetas · {masteredPercent}% dominadas</div></div>
        <button className="ch-refresh" onClick={() => setRefreshKey((value) => value + 1)} title="Actualizar análisis">↻</button>
      </div>
      <div className="ch-progress"><span style={{ width: `${masteredPercent}%` }} /></div>
      <div className="ch-legend">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todas <b>{cards.length}</b></button>
        <button className={filter === 'mastered' ? 'active mastered' : 'mastered'} onClick={() => setFilter('mastered')}><i />Dominadas <b>{counts.mastered}</b></button>
        <button className={filter === 'steady' ? 'active steady' : 'steady'} onClick={() => setFilter('steady')}><i />En progreso <b>{counts.steady}</b></button>
        <button className={filter === 'difficult' ? 'active difficult' : 'difficult'} onClick={() => setFilter('difficult')}><i />Difíciles <b>{counts.difficult}</b></button>
        <button className={filter === 'new' ? 'active new' : 'new'} onClick={() => setFilter('new')}><i />Nuevas <b>{counts.new}</b></button>
      </div>
      <label className="ch-sort">Ordenar por:
        <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
          <option value="difficulty">Mayor dificultad</option><option value="success">Menor retención</option><option value="recent">Último resultado</option>
        </select>
      </label>
      <div className="ch-grid">
        {visible.map((row) => <button key={row.id} className={`ch-tile ${row.level}`} onClick={() => openCard(row)} title={`${row.label} · ${row.reviews ? Math.round(row.success * 100) + '% de retención ponderada' : 'sin repasos'}`}><span className="ch-dot" /><span className="ch-label">{row.label}</span><span className="ch-meta">{row.reviews ? `${Math.round(row.success * 100)}% · ${row.reviews} repasos` : 'nueva'}</span></button>)}
      </div>
      <div className="ch-note">Los colores se aplican al Rem real solo si no tenía un resaltado manual. Rojo = difícil, amarillo = en progreso, verde = dominado. Se actualiza automáticamente cada minuto.</div>
    </section>
  );
};

renderWidget(CardHeatmap);
