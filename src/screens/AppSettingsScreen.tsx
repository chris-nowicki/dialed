import { useState } from "react";
import { useApp } from "../AppContext";
import {
  hasLocalKey,
  removeApiKey,
  setApiKey,
  testApiKey,
} from "../research";
import type { TempUnit } from "../types";
import { ScreenHeader } from "../components/ScreenHeader";

type SaveState = "idle" | "testing" | "success" | "error";

export function AppSettingsScreen() {
  const { goBack, setTempUnit, tempUnit } = useApp();
  const [apiKey, setApiKeyInput] = useState("");
  const [keyStored, setKeyStored] = useState(() => hasLocalKey());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  async function handleSaveAndTest(event: React.FormEvent) {
    event.preventDefault();
    setSaveState("testing");
    setMessage("Checking this key with OpenAI…");

    const result = await testApiKey(apiKey);
    if (result.status !== "valid") {
      setSaveState("error");
      setMessage(result.message);
      return;
    }

    if (!setApiKey(apiKey)) {
      setSaveState("error");
      setMessage("This browser could not store the key. Check its privacy settings.");
      return;
    }

    setApiKeyInput("");
    setKeyStored(true);
    setSaveState("success");
    setMessage("Connected. Live research is ready on this site.");
  }

  function handleRemoveKey() {
    if (!removeApiKey()) {
      setSaveState("error");
      setMessage("This browser could not remove the stored key.");
      return;
    }

    setApiKeyInput("");
    setKeyStored(false);
    setSaveState("idle");
    setMessage("Local API key removed.");
  }

  function selectTempUnit(unit: TempUnit) {
    setTempUnit(unit);
  }

  return (
    <div className="screen app-settings-screen">
      <ScreenHeader title="Settings" onBack={goBack} />

      <div className="settings-hero">
        <p className="settings-eyebrow">Dialed to your setup</p>
        <p className="settings-intro">
          Choose how recipes read, and keep live bean research ready when the platform is not.
        </p>
      </div>

      <section className="settings-panel" aria-labelledby="temperature-heading">
        <div className="settings-panel-heading">
          <div>
            <p className="settings-kicker">Display</p>
            <h3 id="temperature-heading">Temperature</h3>
          </div>
          <span className="settings-value">°{tempUnit}</span>
        </div>
        <div className="unit-picker" role="group" aria-label="Temperature unit">
          {(["F", "C"] as TempUnit[]).map((unit) => (
            <button
              key={unit}
              type="button"
              className={tempUnit === unit ? "active" : ""}
              onClick={() => selectTempUnit(unit)}
              aria-pressed={tempUnit === unit}
            >
              °{unit}
              <span>{unit === "F" ? "Fahrenheit" : "Celsius"}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-panel api-panel" aria-labelledby="api-key-heading">
        <div className="settings-panel-heading">
          <div>
            <p className="settings-kicker">AI research</p>
            <h3 id="api-key-heading">OpenAI backup key</h3>
          </div>
          <span className={`connection-status ${keyStored ? "connected" : ""}`}>
            <span className="status-dot" />
            {keyStored ? "Ready" : "Not set"}
          </span>
        </div>

        <p className="settings-copy">
          Dialed uses the platform credential first. If that route is unavailable, this key keeps
          live bean research working in your browser.
        </p>

        {keyStored && (
          <div className="stored-key-row">
            <span className="stored-key-mask" aria-label="A local API key is stored">
              ••••••••••••••••
            </span>
            <button type="button" className="remove-key-button" onClick={handleRemoveKey}>
              Remove
            </button>
          </div>
        )}

        <form className="api-key-form" onSubmit={handleSaveAndTest}>
          <label className="field-label" htmlFor="openai-api-key">
            {keyStored ? "Replace local key" : "API key"}
          </label>
          <input
            id="openai-api-key"
            className="field-input api-key-input"
            type="password"
            value={apiKey}
            onChange={(event) => {
              setApiKeyInput(event.target.value);
              setSaveState("idle");
              setMessage("");
            }}
            placeholder="sk-…"
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button
            className="cta-btn settings-save-button"
            type="submit"
            disabled={!apiKey.trim() || saveState === "testing"}
          >
            {saveState === "testing" ? "Testing connection…" : "Save & test connection"}
          </button>
        </form>

        {message && (
          <p className={`settings-message ${saveState}`} role="status">
            {message}
          </p>
        )}

        <div className="key-caution">
          <span aria-hidden="true">⌁</span>
          <p>
            Demo-only: this key is stored in this browser and can be read by this site. Use a scoped
            key, then rotate it after the event. A new Zephyr URL may need the key entered again.
          </p>
        </div>
      </section>
    </div>
  );
}
