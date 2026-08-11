import { useState } from "react";
import { useApp } from "../AppContext";
import {
  createRecipeFromSettings,
  ensureAidenProfile,
  getAidenProfileForBean,
  getBean,
  getRecipe,
  updateAidenProfileRecipeSettings,
  updateRecipe,
} from "../storage";
import {
  BREW_VARIANTS,
  OPUS_V1,
  computeDose,
  computeStartingRecipe,
  cupsToOz,
  formatTemp,
} from "../grindEngine";
import { GrindDial } from "../components/GrindDial";
import { ScreenHeader } from "../components/ScreenHeader";
import type { BrewVariant } from "../types";

interface Props {
  beanId: string;
  brewVariant: BrewVariant;
  recipeId?: string;
}

const RATIO_MIN = 12;
const RATIO_MAX = 20;
const TEMP_MIN = 185;
const TEMP_MAX = 210;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function Stepper({
  onDec,
  onInc,
  children,
}: {
  onDec: () => void;
  onInc: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="es-stepper">
      <button className="gb-step-btn es-step" onClick={onDec} aria-label="Decrease">−</button>
      <div className="es-stepper-value">{children}</div>
      <button className="gb-step-btn es-step" onClick={onInc} aria-label="Increase">+</button>
    </div>
  );
}

export function EditSettingsScreen({ beanId, brewVariant, recipeId }: Props) {
  const { navigate, goBack, tempUnit } = useApp();
  const bean = getBean(beanId);
  const existing = recipeId ? getRecipe(recipeId) : undefined;
  const profile = bean
    ? getAidenProfileForBean(beanId) ?? ensureAidenProfile(bean)
    : undefined;
  const definition = BREW_VARIANTS[brewVariant];
  const startingNumbers = computeStartingRecipe({
    roast: bean?.roast ?? "medium",
    brewVariant,
  });
  const [dial, setDial] = useState(
    OPUS_V1.micronToDial(existing?.grindMicron ?? startingNumbers.grindMicron),
  );
  const [ratio, setRatio] = useState(profile?.ratio ?? startingNumbers.ratio);
  const [bloomTempF, setBloomTempF] = useState(
    profile?.bloom.tempF ?? startingNumbers.bloomTempF,
  );
  const [pulseTempsF, setPulseTempsF] = useState<number[]>(() => {
    if (!profile) return [startingNumbers.tempF];
    const pulseBlock = definition.basket === "single"
      ? profile.singleServe
      : profile.batch;
    return pulseBlock.pulseTempsF.slice(0, pulseBlock.numPulses);
  });
  const [cups, setCups] = useState(existing?.cups ?? definition.cups.default);

  if (!bean || !profile) {
    return <div className="screen"><p>Bean not found.</p></div>;
  }

  const grindMicron = OPUS_V1.dialToMicron(dial);
  const dose = computeDose(cups, ratio);

  function changePulseTemperature(index: number, delta: number) {
    setPulseTempsF((temperatures) => temperatures.map((temperature, pulseIndex) => (
      pulseIndex === index
        ? clamp(temperature + delta, TEMP_MIN, TEMP_MAX)
        : temperature
    )));
  }

  function save() {
    if (existing) {
      updateRecipe(existing.id, { grindMicron, cups });
      updateAidenProfileRecipeSettings(beanId, {
        ratio,
        bloomTempF,
        singleServePulseTempsF: definition.basket === "single"
          ? pulseTempsF
          : undefined,
        batchPulseTempF: definition.basket === "batch"
          ? pulseTempsF[0]
          : undefined,
      });
    } else {
      createRecipeFromSettings(bean!, brewVariant, {
        grindMicron,
        ratio,
        bloomTempF,
        pulseTempsF,
        cups,
      });
    }
    navigate({ id: "bean-detail", beanId });
  }

  return (
    <div className="screen">
      <ScreenHeader
        title={existing ? "Edit settings" : "Starting point"}
        context={`${bean.name} · ${definition.label}`}
        onBack={goBack}
      />

      <p className="screen-intro">
        {existing
          ? "Override the current numbers for this brew."
          : `Enter your own numbers for ${definition.label.toLowerCase()}.`}
      </p>

      <div className="card es-card">
        <div className="es-dial">
          <GrindDial dial={dial} size={148} />
        </div>
        <div className="es-grind-steps">
          <button
            className="gb-step-btn es-step"
            onClick={() => setDial((currentDial) => clamp(
              parseFloat((currentDial - OPUS_V1.dialStep).toFixed(2)),
              OPUS_V1.dialMin,
              OPUS_V1.dialMax,
            ))}
            aria-label="Finer"
          >
            −
          </button>
          <span className="es-grind-hint">1 tick</span>
          <button
            className="gb-step-btn es-step"
            onClick={() => setDial((currentDial) => clamp(
              parseFloat((currentDial + OPUS_V1.dialStep).toFixed(2)),
              OPUS_V1.dialMin,
              OPUS_V1.dialMax,
            ))}
            aria-label="Coarser"
          >
            +
          </button>
        </div>
      </div>

      <div className="card es-rows">
        <div className="es-row">
          <span className="es-label">Ratio</span>
          <Stepper
            onDec={() => setRatio((currentRatio) => clamp(currentRatio - 1, RATIO_MIN, RATIO_MAX))}
            onInc={() => setRatio((currentRatio) => clamp(currentRatio + 1, RATIO_MIN, RATIO_MAX))}
          >
            <span className="es-value">1:{ratio}</span>
          </Stepper>
        </div>

        <div className="es-row">
          <span className="es-label">Bloom temp</span>
          <Stepper
            onDec={() => setBloomTempF((temperature) => clamp(temperature - 1, TEMP_MIN, TEMP_MAX))}
            onInc={() => setBloomTempF((temperature) => clamp(temperature + 1, TEMP_MIN, TEMP_MAX))}
          >
            <span className="es-value">{formatTemp(bloomTempF, tempUnit)}</span>
          </Stepper>
        </div>

        {pulseTempsF.map((temperature, index) => (
          <div className="es-row" key={`${brewVariant}-pulse-${index + 1}`}>
            <span className="es-label">
              {definition.basket === "single" ? `Pulse ${index + 1} temp` : "Brew temp"}
            </span>
            <Stepper
              onDec={() => changePulseTemperature(index, -1)}
              onInc={() => changePulseTemperature(index, 1)}
            >
              <span className="es-value">{formatTemp(temperature, tempUnit)}</span>
            </Stepper>
          </div>
        ))}

        <div className="es-row">
          <span className="es-label">Cups</span>
          <Stepper
            onDec={() => setCups((currentCups) => clamp(
              parseFloat((currentCups - definition.cups.step).toFixed(2)),
              definition.cups.min,
              definition.cups.max,
            ))}
            onInc={() => setCups((currentCups) => clamp(
              parseFloat((currentCups + definition.cups.step).toFixed(2)),
              definition.cups.min,
              definition.cups.max,
            ))}
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
        {definition.basket === "single"
          ? "Bloom and ratio are shared across all brews. Each single-serve pulse temperature is saved separately."
          : "Bloom and ratio are shared across all brews. Brew temperature is shared by small and large batch."}
        {" "}Profile changes must be synced in Fellow and affected dial-ins will need a check brew.
      </p>

      <button className="cta-btn" onClick={save}>
        {existing ? "Save settings" : "Save & continue →"}
      </button>
    </div>
  );
}
