import { renderWidget, usePlugin, useTracker, WidgetLocation } from '@remnote/plugin-sdk';
import React, { useEffect, useMemo, useState } from 'react';

type Level = 'mastered' | 'steady' | 'difficult' | 'new';
type CardRow = {
  id: string;
  remId: string;
  label: string;
  reviews: number;
  success: number;
  level: Level;
  lastScore: number | null;
};

const plainText = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(plainText).join('');
  if (typeof value === 'object') return plainText(value.text ?? value.value ?? value.content ?? '');
  return '';
};

const classify = (history: any[] | undefined, wrongInRow = 0): { level: Level; success: number; reviews: number; lastScore: number | null } => {
  const h = history ?? [];
  if (!h.length) return { level: 'new', success: 0, reviews: 0, lastScore: null };
  const scores = h.map((x) => Number(x?.score ?? 0));
  const remembered = scores.filter((s) => s > 0).length;
  const success = remembered / scores.length;
  const lastScore = scores[scores.length - 1] ?? null;
  let level: Level = 'steady';
  if (wrongInRow >= 2 || success < 0.65 || lastScore === 0) level = 'difficult';
  else if (success >= 0.9 && scores.length >= 4) level = 'mastered';
  return { level, success, reviews: scores.length, lastScore };
};

export const CardHeatmap = () => {
  const plugin = usePlugin();
  const context = useTracker(async () => plugin.widget.getWidgetContext<WidgetLocation.DocumentBelowTitle>(), []);
  const rows = useTracker(async () => {
    if (!context?.documentId) return [] as CardRow[];
    const document = await plugin.rem.findOne(context.documentId);
    if (!document) return [] as CardRow[];
    const rems = await document.allRemInDocumentOrPortal();
    const result: CardRow[] = [];
    for (const rem of rems) {
      const cards = await rem.getCards();
      for (const card of cards ?? []) {
        // SDK versions anteriores exponen repetitionHistory; las nuevas usan history.
        const history = (card as any).repetitionHistory ?? (card as any).history;
        const stats = classify(history, card.timesWrongInRow ?? 0);
        result.push({
          id: card._id,
          remId: rem._id,
          label: plainText(rem.text) || 'Tarjeta sin texto',
          ...stats,
        });
      }
    }
    return result;
  }, [context?.documentId]);

  const [filter, setFilter] = useState<'all' | Level>('all');
  const cards = rows ?? [];

  // El heatmap no debe quedarse solamente en este widget: aplica el color
  // nativo de RemNote al Rem que contiene cada tarjeta. De esta forma el
  // usuario ve el nivel directamente en el documento.
  useEffect(() => {
    let cancelled = false;

    const applyColors = async () => {
      const levelByRem = new Map<string, Level>();
      const priority: Record<Level, number> = {
        new: 0,
        mastered: 1,
        steady: 2,
        difficult: 3,
      };

      for (const card of cards) {
        const current = levelByRem.get(card.remId);
        if (!current || priority[card.level] > priority[current]) {
          levelByRem.set(card.remId, card.level);
        }
      }

      for (const [remId, level] of levelByRem) {
        if (cancelled || level === 'new') continue;
        const rem = await plugin.rem.findOne(remId);
        if (!rem || cancelled) continue;

        // setHighlightColor es la API nativa de RemNote, por lo que el color
        // se muestra sobre el item real y no como una copia en el widget.
        const color = level === 'difficult' ? 'Red' : level === 'mastered' ? 'Green' : 'Yellow';
        if (await rem.getHighlightColor() !== color) {
          await rem.setHighlightColor(color);
        }
      }
    };

    if (cards.length) void applyColors();
    return () => {
      cancelled = true;
    };
  }, [cards, plugin]);

  const visible = useMemo(() => filter === 'all' ? cards : cards.filter((c) => c.level === filter), [cards, filter]);
  const counts = useMemo(() => cards.reduce((a, c) => ({ ...a, [c.level]: a[c.level] + 1 }), { mastered: 0, steady: 0, difficult: 0, new: 0 } as Record<Level, number>), [cards]);

  const openCard = async (row: CardRow) => {
    const rem = await plugin.rem.findOne(row.remId);
    if (rem) await plugin.window.openRem(rem);
  };

  if (!context) return <div className="ch-loading">Cargando heatmap…</div>;
  if (!cards.length) return <div className="ch-empty">No hay tarjetas en esta nota todavía.</div>;

  return (
    <section className="ch-card" aria-label="Heatmap de dificultad de tarjetas">
      <div className="ch-header">
        <div>
          <div className="ch-title">Mapa de dominio</div>
          <div className="ch-subtitle">Tarjetas de esta nota · {cards.length} total</div>
        </div>
        <button className="ch-refresh" onClick={() => window.location.reload()} title="Actualizar">↻</button>
      </div>
      <div className="ch-legend">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todas <b>{cards.length}</b></button>
        <button className={filter === 'mastered' ? 'active mastered' : 'mastered'} onClick={() => setFilter('mastered')}><i />Dominadas <b>{counts.mastered}</b></button>
        <button className={filter === 'steady' ? 'active steady' : 'steady'} onClick={() => setFilter('steady')}><i />En progreso <b>{counts.steady}</b></button>
        <button className={filter === 'difficult' ? 'active difficult' : 'difficult'} onClick={() => setFilter('difficult')}><i />Difíciles <b>{counts.difficult}</b></button>
        <button className={filter === 'new' ? 'active new' : 'new'} onClick={() => setFilter('new')}><i />Nuevas <b>{counts.new}</b></button>
      </div>
      <div className="ch-grid">
        {visible.map((row) => (
          <button key={row.id} className={`ch-tile ${row.level}`} onClick={() => openCard(row)} title={`${row.label} · ${row.reviews ? Math.round(row.success * 100) + '% de aciertos' : 'sin repasos'}`}>
            <span className="ch-dot" />
            <span className="ch-label">{row.label}</span>
            <span className="ch-meta">{row.reviews ? `${Math.round(row.success * 100)}% · ${row.reviews} repasos` : 'nueva'}</span>
          </button>
        ))}
      </div>
      <div className="ch-note">El color se aplica al item real de RemNote: rojo = difícil, amarillo = en progreso y verde = dominado. Los items nuevos quedan sin resaltar.</div>
    </section>
  );
};

renderWidget(CardHeatmap);
