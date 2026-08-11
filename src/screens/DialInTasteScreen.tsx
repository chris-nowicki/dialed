import { useState } from 'react';
import { useApp } from '../AppContext';
import { getAidenProfileForBean, getSession, getRecipe, getBean, recordTaste } from '../storage';
import { computeAdjustment, OPUS_V1, formatTemp, formatGrindFromMicron } from '../grindEngine';
import type { TasteResult } from '../types';
import { ScreenHeader } from "../components/ScreenHeader";

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

const TASTE_GROUPS: { title: string; description: string; results: TasteResult[] }[] = [
  {
    title: "Extraction",
    description: "Was the flavor sharp or dry?",
    results: ["sour", "just-right", "bitter"],
  },
  {
    title: "Strength",
    description: "How did the body feel?",
    results: ["weak", "strong"],
  },
];

export function DialInTasteScreen({ sessionId }: Props) {
  const { navigate, goBack, tempUnit } = useApp();
  const session = getSession(sessionId);
  const recipe = session ? getRecipe(session.recipeId) : undefined;
  const bean = recipe ? getBean(recipe.beanId) : undefined;
  const aidenProfile = recipe ? getAidenProfileForBean(recipe.beanId) : undefined;

  const [selected, setSelected] = useState<TasteResult | null>(null);

  if (!session || !recipe || !bean) return <div className="screen"><p>Session not found.</p></div>;

  const batchTemp = aidenProfile?.batch.pulseTempsF[0] ?? recipe.batch.pulseTempsF[0] ?? 200;
  const ratio = aidenProfile?.ratio ?? recipe.ratio;
  const iterationNum = session.events.length + 1;

  function handleTaste(taste: TasteResult) {
    setSelected(taste);
    const adjustment = computeAdjustment(
      taste,
      { grindMicron: recipe!.grindMicron, tempF: batchTemp, ratio },
      { sourBound: session!.sourBound, bitterBound: session!.bitterBound },
      OPUS_V1,
    );

    const result = recordTaste(sessionId, taste, adjustment.narration);
    if (!result) return;
    navigate({ id: 'adjustment', sessionId, eventId: result.event.id });
  }

  return (
    <div className="screen taste-screen">
      <ScreenHeader title={`Taste brew #${iterationNum}`} context={bean.name} onBack={goBack} />

      <div className="taste-intro">
        <p className="screen-eyebrow">Trust your palate</p>
        <h2>What stood out?</h2>
        <p>Pick the closest match. Dialed will change one thing for the next cup.</p>
      </div>

      <div className="current-settings card">
        <div className="settings-row">
          <span>Opus</span><strong>{formatGrindFromMicron(recipe.grindMicron).dial}</strong>
          <span>Temp</span><strong>{formatTemp(batchTemp, tempUnit)}</strong>
          <span>Ratio</span><strong>1:{ratio}</strong>
        </div>
      </div>

      <div className="taste-groups">
        {TASTE_GROUPS.map((group) => (
          <section className={`taste-group ${group.title.toLowerCase()}`} key={group.title}>
            <div className="taste-group-heading">
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </div>
            <div className="taste-buttons">
              {group.results.map((result) => {
                const taste = TASTE_BUTTONS.find((option) => option.result === result)!;
                return (
                  <button
                    key={taste.result}
                    className={`taste-btn ${taste.result} ${selected === taste.result ? "selected" : ""}`}
                    onClick={() => handleTaste(taste.result)}
                  >
                    <span className="taste-emoji">{taste.emoji}</span>
                    <span className="taste-label">{taste.label}</span>
                    <span className="taste-hint">{taste.hint}</span>
                  </button>
                );
              })}
            </div>
          </section>
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
