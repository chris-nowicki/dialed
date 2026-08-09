import { useState } from 'react';
import { useApp } from '../AppContext';
import { getSession, getRecipe, getBean, recordTaste } from '../storage';
import { computeAdjustment, OPUS_V1, formatTemp, formatGrindFromMicron } from '../grindEngine';
import type { TasteResult } from '../types';

interface Props {
  sessionId: string;
}

const TASTE_BUTTONS: { result: TasteResult; label: string; emoji: string; hint: string }[] = [
  { result: 'sour',       label: 'Sour',       emoji: '😬', hint: 'Sharp, tart, acidic' },
  { result: 'bitter',     label: 'Bitter',     emoji: '😤', hint: 'Harsh, astringent' },
  { result: 'weak',       label: 'Weak',       emoji: '💧', hint: 'Watery, thin, flat' },
  { result: 'strong',     label: 'Strong',     emoji: '💪', hint: 'Muddy, heavy, intense' },
  { result: 'just-right', label: 'Just right',  emoji: '✨', hint: 'Balanced, sweet, clean' },
];

export function DialInTasteScreen({ sessionId }: Props) {
  const { navigate, goBack, tempUnit } = useApp();
  const session = getSession(sessionId);
  const recipe = session ? getRecipe(session.recipeId) : undefined;
  const bean = recipe ? getBean(recipe.beanId) : undefined;

  const [selected, setSelected] = useState<TasteResult | null>(null);

  if (!session || !recipe || !bean) return <div className="screen"><p>Session not found.</p></div>;

  const batchTemp = recipe.batch.pulseTempsF[0] ?? 200;
  const iterationNum = session.events.length + 1;

  function handleTaste(taste: TasteResult) {
    setSelected(taste);
    const adjustment = computeAdjustment(
      taste,
      { grindMicron: recipe!.grindMicron, tempF: batchTemp, ratio: recipe!.ratio },
      { sourBound: session!.sourBound, bitterBound: session!.bitterBound },
      OPUS_V1,
    );

    const result = recordTaste(sessionId, taste, adjustment.narration);
    if (!result) return;
    navigate({ id: 'adjustment', sessionId, eventId: result.event.id });
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" onClick={goBack}>← Back</button>
        <h2>Brew #{iterationNum} — how does it taste?</h2>
      </header>

      <div className="current-settings card">
        <div className="settings-row">
          <span>Opus</span><strong>{formatGrindFromMicron(recipe.grindMicron).dial}</strong>
          <span>Temp</span><strong>{formatTemp(batchTemp, tempUnit)}</strong>
          <span>Ratio</span><strong>1:{recipe.ratio}</strong>
        </div>
      </div>

      <div className="taste-buttons">
        {TASTE_BUTTONS.map((t) => (
          <button
            key={t.result}
            className={`taste-btn ${t.result} ${selected === t.result ? 'selected' : ''}`}
            onClick={() => handleTaste(t.result)}
          >
            <span className="taste-emoji">{t.emoji}</span>
            <span className="taste-label">{t.label}</span>
            <span className="taste-hint">{t.hint}</span>
          </button>
        ))}
      </div>

      {session.events.length >= 2 && (
        <button
          className="text-btn"
          onClick={() => navigate({ id: 'converge', sessionId })}
        >
          View progress →
        </button>
      )}
    </div>
  );
}
