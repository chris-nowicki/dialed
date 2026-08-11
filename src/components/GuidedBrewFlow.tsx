import { useState } from "react";
import { useApp } from "../AppContext";
import {
  getRecipe,
  getBean,
  getAidenProfileForBean,
  updateRecipe,
  getActiveSessionForRecipe,
  createSession,
  getPulseTemperatures,
} from "../storage";
import { BREW_VARIANTS, computeDose, cupsToOz, formatTemp } from "../grindEngine";
import { GrindDial } from "./GrindDial";
import { ScreenHeader } from "./ScreenHeader";

interface Props {
  recipeId: string;
  /** 'rate' hands off to the taste loop at the end; 'brew' just finishes. */
  mode: "rate" | "brew";
}

/**
 * Guided, step-by-step brew — one focused screen at a time that mirrors the
 * Aiden's own Guided Brew. Powers both dial-in ("rate") and plain brewing.
 */
export function GuidedBrewFlow({ recipeId, mode }: Props) {
  const { navigate, goBack, tempUnit } = useApp();
  const recipe = getRecipe(recipeId);
  const bean = recipe ? getBean(recipe.beanId) : undefined;
  const aidenProfile = recipe ? getAidenProfileForBean(recipe.beanId) : undefined;

  const [cups, setCups] = useState<number>(
    () => recipe?.cups ?? BREW_VARIANTS["large-batch"].cups.default,
  );
  const [step, setStep] = useState(0);

  if (!recipe || !bean) return <div className="screen"><p>Recipe not found.</p></div>;

  if (!aidenProfile || aidenProfile.status !== "ready") {
    return (
      <div className="screen gb-screen">
        <ScreenHeader title="Guided brew" context={bean.name} onBack={goBack} />
        <div className="card gb-profile-gate">
          <p className="screen-eyebrow">Aiden profile required</p>
          <h2>Confirm the profile first.</h2>
          <p>Guided Brew needs the matching profile saved in Fellow before you continue.</p>
          <button
            type="button"
            className="cta-btn"
            onClick={() => navigate({
              id: "aiden-profile",
              beanId: bean.id,
              recipeId,
              mode,
            })}
          >
            Open profile guide
          </button>
        </div>
      </div>
    );
  }

  const definition = BREW_VARIANTS[recipe.brewVariant];
  const range = definition.cups;
  const pulseTemps = getPulseTemperatures(aidenProfile, recipe.brewVariant);
  const temperatureSummary = definition.basket === "single"
    ? `Bloom ${formatTemp(aidenProfile.bloom.tempF, tempUnit)} · Pulses ${pulseTemps.map((temperature) => formatTemp(temperature, tempUnit)).join(" / ")}`
    : `Bloom ${formatTemp(aidenProfile.bloom.tempF, tempUnit)} · Brew ${formatTemp(pulseTemps[0] ?? 200, tempUnit)}`;
  const profileRatio = aidenProfile.ratio;
  const dose = computeDose(cups, profileRatio);

  function changeCups(next: number) {
    const clamped = Math.min(range.max, Math.max(range.min, parseFloat(next.toFixed(2))));
    setCups(clamped);
    updateRecipe(recipeId, { cups: clamped });
  }

  const steps: { label: string; title: string; body: React.ReactNode; hint?: string }[] = [
    {
      label: "Profile",
      title: 'Pick your profile',
      body: (
        <div className="gb-profile">
          <span className="gb-crumb">Guided Brew › Pick Profile</span>
          <span className="gb-profile-name">{aidenProfile.name}</span>
          <span className="gb-profile-temps">{temperatureSummary}</span>
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
        context={`${bean.name} · ${definition.label}`}
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
          <p className="gb-context">1:{profileRatio} · {temperatureSummary} · {cups} cups</p>
        )}
      </div>

      <button className="cta-btn gb-next" onClick={next}>
        {isLast ? (mode === 'rate' ? 'I brewed it — rate the taste →' : 'Done ☕') : 'Next →'}
      </button>
    </div>
  );
}
