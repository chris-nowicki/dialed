import { useState } from "react";
import { useApp } from "../AppContext";
import {
  getBean,
  getAidenProfileForBean,
  updateBean,
  getPulseTemperatures,
  getRecipeForBeanVariant,
  getActiveSessionForRecipe,
  createStartingRecipe,
  markDialedIn,
  reopenRecipe,
  deleteBean,
} from "../storage";
import {
  BREW_VARIANT_ORDER,
  BREW_VARIANTS,
  computeDose,
  formatTemp,
} from "../grindEngine";
import { GrindDial } from "../components/GrindDial";
import type { BrewVariant, RoastLevel } from "../types";
import { ScreenHeader } from "../components/ScreenHeader";

interface Props {
  beanId: string;
}

export function BeanDetailScreen({ beanId }: Props) {
  const { navigate, tempUnit } = useApp();
  const bean = getBean(beanId);

  // Prefer the large-batch target because it is the seeded default.
  const initialVariant: BrewVariant = getRecipeForBeanVariant(beanId, "large-batch")
    ? "large-batch"
    : getRecipeForBeanVariant(beanId, "small-batch")
      ? "small-batch"
      : getRecipeForBeanVariant(beanId, "single")
        ? "single"
        : "large-batch";

  const [brewVariant, setBrewVariant] = useState<BrewVariant>(initialVariant);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, setRefresh] = useState(0);
  const bump = () => setRefresh((r) => r + 1);

  if (!bean) return <div className="screen"><p>Bean not found.</p></div>;

  const recipe = getRecipeForBeanVariant(beanId, brewVariant);
  const aidenProfile = getAidenProfileForBean(beanId);
  const session = recipe ? getActiveSessionForRecipe(recipe.id) : undefined;
  const lastEvent = session?.events[session.events.length - 1];
  const suggestDialed = lastEvent?.tasteResult === "just-right";
  const pulseTemps = aidenProfile
    ? getPulseTemperatures(aidenProfile, brewVariant)
    : [];
  const tempSummary = aidenProfile
    ? BREW_VARIANTS[brewVariant].basket === "single"
      ? `B ${formatTemp(aidenProfile.bloom.tempF, tempUnit)} · P ${pulseTemps.map((temperature) => formatTemp(temperature, tempUnit)).join("/")}`
      : formatTemp(pulseTemps[0] ?? 200, tempUnit)
    : "—";
  const ratio = aidenProfile?.ratio;
  const dose = recipe && ratio ? computeDose(recipe.cups, ratio) : undefined;

  function startDialing() {
    const created = createStartingRecipe(bean!, brewVariant);
    startGuidedBrew(created.id, "rate");
  }

  function startGuidedBrew(recipeId: string, mode: "rate" | "brew") {
    if (!aidenProfile || aidenProfile.status !== "ready") {
      navigate({ id: "aiden-profile", beanId, recipeId, mode });
      return;
    }
    navigate({ id: "guided-brew", recipeId, mode });
  }

  function handleDelete() {
    deleteBean(beanId);
    navigate({ id: 'home' });
  }

  return (
    <div className="screen bean-detail">
      <ScreenHeader
        title="Bean profile"
        context={`${bean.roaster}${bean.origin ? ` · ${bean.origin}` : ""}`}
        onBack={() => navigate({ id: "home" })}
        backLabel="Back to beans"
      />

      <div className="bd-hero">
        <div className="bd-identity">
          <div>
            <p className="screen-eyebrow">Coffee profile</p>
            <h2 className="bd-name">{bean.name}</h2>
          </div>
          <span className={`bd-overall-status ${recipe?.status === "dialed-in" ? "dialed" : ""}`}>
            {recipe?.status === "dialed-in"
              ? "Dialed in"
              : recipe?.status === "needs-recheck"
                ? "Check again"
                : recipe
                  ? "In progress"
                  : "Fresh bag"}
          </span>
        </div>
        {bean.tastingNotes.length > 0 && (
          <div className="tasting-notes bd-notes">
            {bean.tastingNotes.map((n) => <span key={n} className="note-tag">{n}</span>)}
          </div>
        )}
        <div className="bd-roast">
          <div className="bd-roast-head">
            <span className="bd-roast-label">Roast</span>
            {bean.initialRoast && bean.initialRoast !== bean.roast && (
              <span className="bd-roast-note">adjusted from {bean.initialRoast}</span>
            )}
          </div>
          <div className="roast-picker">
            {(['light', 'medium', 'dark'] as RoastLevel[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`roast-btn ${bean.roast === r ? 'active' : ''}`}
                onClick={() => { updateBean(beanId, { roast: r }); bump(); }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <details className="bd-research">
        <summary>
          <span className="bd-research-title">The Origin Story</span>
          <span className="bd-research-chevron" aria-hidden="true" />
        </summary>
        <div className="bd-research-body">
          {bean.process && (
            <p className="bd-research-meta">Process · <strong>{bean.process}</strong></p>
          )}
          {bean.description && <p className="bean-description">{bean.description}</p>}
          <div className="bd-sources">
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(`${bean.roaster} ${bean.name} coffee`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bd-source"
            >
              Look it up<span className="bd-source-arrow">↗</span>
            </a>
          </div>
        </div>
      </details>

      <section className={`bd-aiden-card ${aidenProfile?.status ?? "needs-setup"}`}>
        <div className="bd-aiden-copy">
          <p className="screen-eyebrow">Aiden profile</p>
          <h3>{aidenProfile?.name ?? bean.name}</h3>
          <p>
            {aidenProfile?.status === "ready"
              ? "Saved in Fellow and ready for Guided Brew."
              : aidenProfile?.status === "needs-update"
                ? "A shared brew setting changed. Update it in Fellow before brewing."
                : "Create this profile in Fellow before your first brew."}
          </p>
        </div>
        <div className="bd-aiden-action">
          <span className={`connection-status ${aidenProfile?.status === "ready" ? "connected" : ""}`}>
            <span className="status-dot" />
            {aidenProfile?.status === "ready"
              ? "Ready"
              : aidenProfile?.status === "needs-update"
                ? "Update"
                : "Setup"}
          </span>
          <button
            type="button"
            onClick={() => navigate({ id: "aiden-profile", beanId })}
          >
            {aidenProfile?.status === "ready" ? "View" : "Open guide"}
          </button>
        </div>
      </section>

      {/* Brew variant selector */}
      <div className="bd-baskets">
        {BREW_VARIANT_ORDER.map((variant) => {
          const definition = BREW_VARIANTS[variant];
          const variantRecipe = getRecipeForBeanVariant(beanId, variant);
          const state = !variantRecipe
            ? "none"
            : variantRecipe.status === "dialed-in"
              ? "dialed"
              : variantRecipe.status === "needs-recheck"
                ? "recheck"
                : "dialing";
          return (
            <button
              key={variant}
              className={`bd-basket ${brewVariant === variant ? "active" : ""}`}
              onClick={() => setBrewVariant(variant)}
            >
              <span className="bd-basket-label">{definition.label}</span>
              <span className="bd-basket-sub">{definition.description}</span>
              <span className={`chip chip-${state}`}>
                {state === "none"
                  ? "Not started"
                  : state === "dialed"
                    ? "Dialed in"
                    : state === "recheck"
                      ? "Check again"
                      : "Dialing"}
              </span>
            </button>
          );
        })}
      </div>

      {recipe ? (
        <>
          <div className="card bd-nextbrew">
            <div className="bd-card-top">
              <div>
                <span className="bd-card-label">Next brew</span>
                <h3 className="bd-card-title">Your target recipe</h3>
              </div>
              <button
                className="bd-edit"
                onClick={() => navigate({
                  id: "edit-settings",
                  beanId,
                  brewVariant,
                  recipeId: recipe.id,
                })}
              >
                Edit
              </button>
            </div>
            <p className="bd-dial-kicker">Set Opus to</p>
            <GrindDial micron={recipe.grindMicron} size={148} />
            <div className="bd-metrics">
              <div className="recipe-stat">
                <span className="stat-label">Dose</span>
                <span className="stat-value">{dose} g</span>
              </div>
              <div className="recipe-stat">
                <span className="stat-label">Cups</span>
                <span className="stat-value">{recipe.cups}</span>
              </div>
              <div className="recipe-stat">
                <span className="stat-label">Ratio</span>
                <span className="stat-value">1:{ratio}</span>
              </div>
              <div className="recipe-stat">
                <span className="stat-label">Temp</span>
                <span className="stat-value bd-temp-sequence">{tempSummary}</span>
              </div>
            </div>
          </div>

          {recipe.status === "dialed-in" ? (
            <>
              <button className="cta-btn" onClick={() => startGuidedBrew(recipe.id, "brew")}>
                Brew it ☕
              </button>
              <button
                className="text-btn bd-center"
                onClick={() => { const r = reopenRecipe(recipe.id); if (r) startGuidedBrew(r.id, "rate"); }}
              >
                Reopen & tune
              </button>
            </>
          ) : (
            <>
              <button className="cta-btn" onClick={() => startGuidedBrew(recipe.id, "rate")}>
                {recipe.status === "needs-recheck" ? "Check brew & rate →" : "Brew & rate →"}
              </button>
              <button
                className={`mark-dialed ${suggestDialed ? 'glow' : ''}`}
                onClick={() => { markDialedIn(recipe.id); bump(); }}
              >
                ✓ Mark as dialed in
              </button>
              {session && session.events.length > 0 && (
                <button className="text-btn bd-center" onClick={() => navigate({ id: 'converge', sessionId: session.id })}>
                  View progress ({session.events.length} brew{session.events.length === 1 ? '' : 's'})
                </button>
              )}
            </>
          )}
        </>
      ) : (
        <div className="card bd-empty-basket">
          <p>
            You haven’t dialed in <strong>{BREW_VARIANTS[brewVariant].label.toLowerCase()}</strong> yet.
          </p>
          <button className="cta-btn bd-inline-cta" onClick={startDialing}>Start dialing →</button>
          <button
            className="text-btn bd-center"
            onClick={() => navigate({ id: "edit-settings", beanId, brewVariant })}
          >
            Set my own starting point
          </button>
        </div>
      )}

      {/* Danger zone */}
      {confirmDelete ? (
        <div className="card bd-confirm">
          <p>Delete <strong>{bean.name}</strong>? This removes all its dial-in data.</p>
          <div className="bd-confirm-actions">
            <button className="secondary-btn bd-inline" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="danger-btn bd-inline" onClick={handleDelete}>Delete</button>
          </div>
        </div>
      ) : (
        <button className="text-btn bd-delete" onClick={() => setConfirmDelete(true)}>Delete bean</button>
      )}
    </div>
  );
}
