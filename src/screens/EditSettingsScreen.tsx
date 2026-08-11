import { useState } from 'react';
import { useApp } from '../AppContext';
import {
  getBean,
  getAidenProfileForBean,
  getRecipe,
  updateRecipe,
  createRecipeFromSettings,
  ensureAidenProfile,
  updateAidenProfileRecipeSettings,
} from '../storage';
import {
  OPUS_V1,
  computeStartingRecipe,
  computeDose,
  formatTemp,
  formatGrind,
  cupsToOz,
  BASKET_CUPS,
} from '../grindEngine';
import { GrindDial } from '../components/GrindDial';
import type { BrewSize } from '../types';
import { ScreenHeader } from "../components/ScreenHeader";

interface Props {
  beanId: string;
  brewSize: BrewSize;
  recipeId?: string;
}

const RATIO_MIN = 12;
const RATIO_MAX = 20;
const TEMP_MIN = 185;
const TEMP_MAX = 210;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function Stepper({ onDec, onInc, children }: { onDec: () => void; onInc: () => void; children: React.ReactNode }) {
  return (
    <div className="es-stepper">
      <button className="gb-step-btn es-step" onClick={onDec} aria-label="Decrease">−</button>
      <div className="es-stepper-value">{children}</div>
      <button className="gb-step-btn es-step" onClick={onInc} aria-label="Increase">+</button>
    </div>
  );
}

export function EditSettingsScreen({ beanId, brewSize, recipeId }: Props) {
  const { navigate, goBack, tempUnit } = useApp();
  const bean = getBean(beanId);
  const existing = recipeId ? getRecipe(recipeId) : undefined;
  const aidenProfile = bean
    ? getAidenProfileForBean(beanId) ?? ensureAidenProfile(bean)
    : undefined;

  const seed = existing
    ? {
        dial: OPUS_V1.micronToDial(existing.grindMicron),
        ratio: aidenProfile?.ratio ?? existing.ratio,
        tempF: aidenProfile?.batch.pulseTempsF[0] ?? existing.batch.pulseTempsF[0] ?? 200,
        cups: existing.cups ?? BASKET_CUPS[brewSize].default,
      }
    : (() => {
        const n = computeStartingRecipe({ roast: bean?.roast ?? 'medium', brewSize });
        return {
          dial: OPUS_V1.micronToDial(n.grindMicron),
          ratio: n.ratio,
          tempF: n.tempF,
          cups: BASKET_CUPS[brewSize].default,
        };
      })();

  const [dial, setDial] = useState(seed.dial);
  const [ratio, setRatio] = useState(seed.ratio);
  const [tempF, setTempF] = useState(seed.tempF);
  const [cups, setCups] = useState(seed.cups);

  if (!bean) return <div className="screen"><p>Bean not found.</p></div>;

  const range = BASKET_CUPS[brewSize];
  const grindMicron = OPUS_V1.dialToMicron(dial);
  const grindDisplay = formatGrind(dial).dial.toFixed(2);
  const dose = computeDose(cups, ratio);

  function save() {
    if (existing) {
      updateRecipe(existing.id, {
        grindMicron,
        grindDisplay,
        cups,
        dose,
      });
      updateAidenProfileRecipeSettings(beanId, { ratio, tempF });
    } else {
      createRecipeFromSettings(bean!, brewSize, { grindMicron, grindDisplay, ratio, tempF, cups });
    }
    navigate({ id: 'bean-detail', beanId });
  }

  return (
    <div className="screen">
      <ScreenHeader
        title={existing ? "Edit settings" : "Starting point"}
        context={`${bean.name} · ${brewSize === "single" ? "Single" : "Batch"}`}
        onBack={goBack}
      />

      <p className="screen-intro">
        {existing
          ? 'Override the current numbers for this brew.'
          : `Enter your own numbers for the ${brewSize === 'single' ? 'single (cone)' : 'batch (flat)'} basket.`}
      </p>

      <div className="card es-card">
        <div className="es-dial">
          <GrindDial dial={dial} size={148} />
        </div>
        <div className="es-grind-steps">
          <button className="gb-step-btn es-step" onClick={() => setDial((d) => clamp(parseFloat((d - OPUS_V1.dialStep).toFixed(2)), OPUS_V1.dialMin, OPUS_V1.dialMax))} aria-label="Coarser">−</button>
          <span className="es-grind-hint">1 tick</span>
          <button className="gb-step-btn es-step" onClick={() => setDial((d) => clamp(parseFloat((d + OPUS_V1.dialStep).toFixed(2)), OPUS_V1.dialMin, OPUS_V1.dialMax))} aria-label="Finer">+</button>
        </div>
      </div>

      <div className="card es-rows">
        <div className="es-row">
          <span className="es-label">Ratio</span>
          <Stepper
            onDec={() => setRatio((r) => clamp(r - 1, RATIO_MIN, RATIO_MAX))}
            onInc={() => setRatio((r) => clamp(r + 1, RATIO_MIN, RATIO_MAX))}
          >
            <span className="es-value">1:{ratio}</span>
          </Stepper>
        </div>

        <div className="es-row">
          <span className="es-label">Temp</span>
          <Stepper
            onDec={() => setTempF((t) => clamp(t - 1, TEMP_MIN, TEMP_MAX))}
            onInc={() => setTempF((t) => clamp(t + 1, TEMP_MIN, TEMP_MAX))}
          >
            <span className="es-value">{formatTemp(tempF, tempUnit)}</span>
          </Stepper>
        </div>

        <div className="es-row">
          <span className="es-label">Cups</span>
          <Stepper
            onDec={() => setCups((c) => clamp(parseFloat((c - range.step).toFixed(2)), range.min, range.max))}
            onInc={() => setCups((c) => clamp(parseFloat((c + range.step).toFixed(2)), range.min, range.max))}
          >
            <span className="es-value">{cups}</span>
            <span className="es-sub">{cupsToOz(cups)} oz</span>
          </Stepper>
        </div>

        <div className="es-row es-derived">
          <span className="es-label">Dose</span>
          <span className="es-value">{dose} g</span>
        </div>
      </div>

      <p className="es-profile-note">
        Ratio and temperature belong to the shared Aiden profile and apply to both baskets.
        Changing either will require a quick update in Fellow.
      </p>

      <button className="cta-btn" onClick={save}>
        {existing ? 'Save settings' : 'Save & continue →'}
      </button>
    </div>
  );
}
