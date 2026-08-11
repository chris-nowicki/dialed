import { useState } from 'react';
import { useApp } from '../AppContext';
import {
  getRecipe,
  getBean,
  updateRecipe,
  getActiveSessionForRecipe,
  createSession,
} from '../storage';
import { computeDose, cupsToOz, formatTemp, BASKET_CUPS } from '../grindEngine';
import { GrindDial } from './GrindDial';
import { ScreenHeader } from "./ScreenHeader";

interface Props {
  recipeId: string;
  /** 'rate' hands off to the taste loop at the end; 'brew' just finishes. */
  mode: 'rate' | 'brew';
}

/**
 * Guided, step-by-step brew — one focused screen at a time that mirrors the
 * Aiden's own Guided Brew. Powers both dial-in ("rate") and plain brewing.
 */
export function GuidedBrewFlow({ recipeId, mode }: Props) {
  const { navigate, goBack, tempUnit } = useApp();
  const recipe = getRecipe(recipeId);
  const bean = recipe ? getBean(recipe.beanId) : undefined;

  const [cups, setCups] = useState<number>(
    () => recipe?.cups ?? BASKET_CUPS[recipe?.brewSize ?? 'batch'].default,
  );
  const [step, setStep] = useState(0);

  if (!recipe || !bean) return <div className="screen"><p>Recipe not found.</p></div>;

  const range = BASKET_CUPS[recipe.brewSize];
  const temp = recipe.batch.pulseTempsF[0] ?? 200;
  const dose = computeDose(cups, recipe.ratio);

  function changeCups(next: number) {
    const clamped = Math.min(range.max, Math.max(range.min, parseFloat(next.toFixed(2))));
    setCups(clamped);
    updateRecipe(recipeId, { cups: clamped, dose: computeDose(clamped, recipe!.ratio) });
  }

  const steps: { label: string; title: string; body: React.ReactNode; hint?: string }[] = [
    {
      label: "Profile",
      title: 'Pick your profile',
      body: (
        <div className="gb-profile">
          <span className="gb-crumb">Guided Brew › Pick Profile</span>
          <span className="gb-profile-name">{recipe.aidenProfileName}</span>
        </div>
      ),
      hint: 'On the Aiden, choose Guided Brew, then select this profile.',
    },
    {
      label: "Cups",
      title: 'How many cups?',
      body: (
        <div className="gb-cups">
          <button className="gb-step-btn" onClick={() => changeCups(cups - range.step)} aria-label="Fewer cups">−</button>
          <div className="gb-cups-value">
            <span className="gb-cups-num">{cups}</span>
            <span className="gb-cups-unit">cups</span>
            <span className="gb-cups-oz">{cupsToOz(cups)} oz</span>
          </div>
          <button className="gb-step-btn" onClick={() => changeCups(cups + range.step)} aria-label="More cups">+</button>
        </div>
      ),
      hint: 'Match the cup count you set on the Aiden dial.',
    },
    {
      label: "Grind",
      title: 'Set the grind',
      body: <GrindDial micron={recipe.grindMicron} size={168} />,
      hint: 'On your Opus grinder.',
    },
    {
      label: "Dose",
      title: 'Add coffee',
      body: (
        <div className="gb-metric">
          <span className="gb-metric-num">{dose}</span>
          <span className="gb-metric-unit">grams</span>
        </div>
      ),
      hint: `Weigh out ${dose} g of your grounds — the Aiden shows this same number.`,
    },
    {
      label: "Water",
      title: 'Top off the water tank',
      body: (
        <div className="gb-water-visual" aria-hidden="true">
          <span className="gb-water-drop" />
          <span className="gb-water-line one" />
          <span className="gb-water-line two" />
          <span className="gb-water-line three" />
        </div>
      ),
      hint: 'Just keep it full — the Aiden meters the exact water for you.',
    },
    {
      label: "Brew",
      title: 'Press brew',
      body: (
        <div className="gb-brew-visual" aria-hidden="true">
          <span className="gb-steam one" />
          <span className="gb-steam two" />
          <span className="gb-cup"><span /></span>
        </div>
      ),
      hint: mode === 'rate'
        ? 'Start the brew on the Aiden. When it’s done and you’ve tasted it, continue.'
        : 'Start the brew on the Aiden. Enjoy!',
    },
  ];

  const isLast = step === steps.length - 1;
  const current = steps[step];

  function next() {
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    if (mode === 'rate') {
      const session = getActiveSessionForRecipe(recipeId) ?? createSession(recipeId, recipe!.beanId);
      navigate({ id: 'taste', sessionId: session.id });
    } else {
      navigate({ id: 'bean-detail', beanId: recipe!.beanId });
    }
  }

  function back() {
    if (step === 0) goBack();
    else setStep((s) => s - 1);
  }

  return (
    <div className="screen gb-screen">
      <ScreenHeader
        title="Guided brew"
        context={`${bean.name} · ${recipe.brewSize === "single" ? "Single" : "Batch"}`}
        onBack={back}
      />

      <ol className="gb-progress" aria-label={`Brew progress, step ${step + 1} of ${steps.length}`}>
        {steps.map((brewStep, i) => (
          <li
            key={brewStep.label}
            className={`${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
            aria-current={i === step ? "step" : undefined}
          >
            <span className="gb-progress-marker">{i < step ? "✓" : i + 1}</span>
            <span className="gb-progress-label">{brewStep.label}</span>
          </li>
        ))}
      </ol>

      <div className="gb-body" key={step}>
        <span className="gb-stepno">Step {step + 1} of {steps.length}</span>
        <h2 className="gb-title">{current.title}</h2>
        <div className="gb-content">{current.body}</div>
        {current.hint && <p className="gb-hint">{current.hint}</p>}
        {(step === 2 || step === 3) && (
          <p className="gb-context">1:{recipe.ratio} · {formatTemp(temp, tempUnit)} · {cups} cups</p>
        )}
      </div>

      <button className="cta-btn gb-next" onClick={next}>
        {isLast ? (mode === 'rate' ? 'I brewed it — rate the taste →' : 'Done ☕') : 'Next →'}
      </button>
    </div>
  );
}
