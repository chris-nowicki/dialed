import { useMemo, useState } from "react";
import { ScreenHeader } from "../components/ScreenHeader";
import { useApp } from "../AppContext";
import { formatTemp } from "../grindEngine";
import {
  type AidenProfileSettings,
  confirmAidenProfile,
  ensureAidenProfile,
  getBean,
  getBuiltInAidenProfile,
} from "../storage";
import type { AidenProfile, PulseBlock } from "../types";

interface AidenProfileScreenProps {
  beanId: string;
  recipeId?: string;
  mode?: "rate" | "brew";
}

interface ProfileField {
  section: string;
  label: string;
  value: string;
  baseValue?: string;
}

function pulseTemperatures(block: PulseBlock, unit: "F" | "C"): string[] {
  return block.pulseTempsF
    .slice(0, block.numPulses)
    .map((temperature) => formatTemp(temperature, unit));
}

function overallTemperature(
  settings: AidenProfileSettings,
  unit: "F" | "C",
): string {
  const temperatures = [
    settings.bloom.tempF,
    ...settings.singleServe.pulseTempsF,
    ...settings.batch.pulseTempsF,
  ];
  const uniqueTemperatures = new Set(temperatures);
  return uniqueTemperatures.size === 1
    ? formatTemp(temperatures[0] ?? 200, unit)
    : "Mixed";
}

function profileFields(
  profile: AidenProfile,
  unit: "F" | "C",
  base?: AidenProfileSettings,
  baseName?: string,
): ProfileField[] {
  const fields: ProfileField[] = [
    {
      section: "Profile",
      label: "Profile name",
      value: profile.name,
      baseValue: base ? baseName : undefined,
    },
    {
      section: "Profile",
      label: "Temperature",
      value: overallTemperature(profile, unit),
      baseValue: base ? overallTemperature(base, unit) : undefined,
    },
    {
      section: "Profile",
      label: "Coffee-to-Water Ratio",
      value: `1:${profile.ratio}`,
      baseValue: base ? `1:${base.ratio}` : undefined,
    },
    {
      section: "Profile",
      label: "Cold Brew",
      value: profile.coldBrew ? "On" : "Off",
      baseValue: base ? (base.coldBrew ? "On" : "Off") : undefined,
    },
    {
      section: "Bloom",
      label: "Bloom",
      value: profile.bloom.enabled ? "On" : "Off",
      baseValue: base ? (base.bloom.enabled ? "On" : "Off") : undefined,
    },
    {
      section: "Bloom",
      label: "Bloom Ratio",
      value: `1:${profile.bloom.ratio}`,
      baseValue: base ? `1:${base.bloom.ratio}` : undefined,
    },
    {
      section: "Bloom",
      label: "Bloom Time",
      value: `${profile.bloom.timeSec}s`,
      baseValue: base ? `${base.bloom.timeSec}s` : undefined,
    },
    {
      section: "Bloom",
      label: "Bloom Temperature",
      value: formatTemp(profile.bloom.tempF, unit),
      baseValue: base ? formatTemp(base.bloom.tempF, unit) : undefined,
    },
    {
      section: "Single Serve Pulses",
      label: "Number of Pulses",
      value: String(profile.singleServe.numPulses),
      baseValue: base ? String(base.singleServe.numPulses) : undefined,
    },
    {
      section: "Single Serve Pulses",
      label: "Time between pulses",
      value: `${profile.singleServe.timeBetweenSec}s`,
      baseValue: base ? `${base.singleServe.timeBetweenSec}s` : undefined,
    },
    ...pulseTemperatures(profile.singleServe, unit).map((value, index) => ({
      section: "Single Serve Pulses",
      label: `Pulse ${index + 1} temperature`,
      value,
      baseValue: base ? pulseTemperatures(base.singleServe, unit)[index] : undefined,
    })),
    {
      section: "Batch Pulses",
      label: "Number of Pulses",
      value: String(profile.batch.numPulses),
      baseValue: base ? String(base.batch.numPulses) : undefined,
    },
    {
      section: "Batch Pulses",
      label: "Time between pulses",
      value: `${profile.batch.timeBetweenSec}s`,
      baseValue: base ? `${base.batch.timeBetweenSec}s` : undefined,
    },
    ...pulseTemperatures(profile.batch, unit).map((value, index) => ({
      section: "Batch Pulses",
      label: `Pulse ${index + 1} temperature`,
      value,
      baseValue: base ? pulseTemperatures(base.batch, unit)[index] : undefined,
    })),
  ];
  return fields;
}

function FieldList({ fields }: { fields: ProfileField[] }) {
  const sections = [...new Set(fields.map((field) => field.section))];
  return (
    <div className="aiden-field-sections">
      {sections.map((section) => (
        <section key={section} className="aiden-field-section">
          <h3>{section}</h3>
          <div className="aiden-field-list">
            {fields.filter((field) => field.section === section).map((field) => (
              <div className="aiden-field" key={`${section}-${field.label}`}>
                <span>{field.label}</span>
                <div className="aiden-field-values">
                  {field.baseValue && field.baseValue !== field.value && (
                    <small>{field.baseValue}</small>
                  )}
                  <strong>{field.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function AidenProfileScreen({
  beanId,
  recipeId,
  mode,
}: AidenProfileScreenProps) {
  const { goBack, replace, tempUnit } = useApp();
  const bean = getBean(beanId);
  const profile = bean ? ensureAidenProfile(bean) : undefined;
  const [copied, setCopied] = useState(false);
  const isUpdate = profile?.status === "needs-update";
  const roastName = profile
    ? `${profile.baseRoast[0]?.toUpperCase()}${profile.baseRoast.slice(1)} Roast`
    : "Roast profile";

  const comparisonProfile = useMemo(
    () => profile
      ? profile.status === "needs-update" && profile.confirmedSettings
        ? profile.confirmedSettings
        : getBuiltInAidenProfile(profile.baseRoast)
      : undefined,
    [profile?.baseRoast, profile?.status, profile?.confirmedAt],
  );
  const allFields = profile ? profileFields(profile, tempUnit) : [];
  const changedFields = profile && comparisonProfile
    ? profileFields(
        profile,
        tempUnit,
        comparisonProfile,
        isUpdate ? profile.name : roastName,
      ).filter(
        (field) => field.baseValue === undefined || field.value !== field.baseValue,
      )
    : [];

  if (!bean || !profile) {
    return <div className="screen"><p>Bean profile not found.</p></div>;
  }

  async function copyProfileName() {
    try {
      await navigator.clipboard.writeText(profile!.name);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function confirmProfile() {
    confirmAidenProfile(beanId);
    if (recipeId && mode) {
      replace({ id: "guided-brew", recipeId, mode });
      return;
    }
    replace({ id: "bean-detail", beanId });
  }

  return (
    <div className="screen aiden-setup-screen">
      <ScreenHeader title="Aiden profile" context={bean.name} onBack={goBack} />

      <div className="aiden-setup-hero">
        <p className="screen-eyebrow">{isUpdate ? "Sync before brewing" : "One-time setup"}</p>
        <h2>{isUpdate ? "Update your Fellow profile." : "Create it in Fellow."}</h2>
        <p>
          {isUpdate
            ? "Dialed changed a shared brew setting. Apply the highlighted value in Fellow, then confirm it is saved."
            : `Copy Fellow’s ${roastName} profile, rename it, and apply the changes below.`}
        </p>
      </div>

      {isUpdate ? (
        <ol className="aiden-setup-steps">
          <li><span>1</span><p>Open the <strong>Fellow app</strong> and select your Aiden.</p></li>
          <li><span>2</span><p>Open <strong>{profile.name}</strong> in your Custom profiles.</p></li>
          <li><span>3</span><p>Apply the change below, then tap <strong>Save</strong>.</p></li>
        </ol>
      ) : (
        <ol className="aiden-setup-steps">
          <li><span>1</span><p>Open the <strong>Fellow app</strong> and select your Aiden.</p></li>
          <li><span>2</span><p>Open <strong>{roastName}</strong>, scroll down, and tap <strong>Create Copy</strong>.</p></li>
          <li>
            <span>3</span>
            <div className="aiden-name-step">
              <p>Name the profile:</p>
              <button type="button" onClick={copyProfileName} className="aiden-copy-name">
                <strong>{profile.name}</strong>
                <small>{copied ? "Copied" : "Copy"}</small>
              </button>
            </div>
          </li>
          <li><span>4</span><p>Apply these changes, then tap <strong>Save</strong> in Fellow.</p></li>
        </ol>
      )}

      <section className="aiden-changes" aria-labelledby="aiden-changes-title">
        <div className="aiden-section-heading">
          <div>
            <p className="screen-eyebrow">Change in Fellow</p>
            <h2 id="aiden-changes-title">{changedFields.length} setting{changedFields.length === 1 ? "" : "s"}</h2>
          </div>
          <span>{isUpdate ? "Saved → New" : "Preset → New"}</span>
        </div>
        <FieldList fields={changedFields} />
      </section>

      <details className="aiden-complete-profile">
        <summary>
          <span>Creating from scratch?</span>
          <strong>View all settings</strong>
        </summary>
        <div className="aiden-complete-body">
          <p>Enter these values in the same order they appear in Fellow.</p>
          <FieldList fields={allFields} />
        </div>
      </details>

      <div className="aiden-confirm-bar">
        <p>After the profile appears in Fellow’s Custom folder:</p>
        <button type="button" className="cta-btn" onClick={confirmProfile}>
          Confirm profile is created
        </button>
      </div>
    </div>
  );
}
