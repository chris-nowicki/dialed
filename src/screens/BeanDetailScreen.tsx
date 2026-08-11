import { useState } from "react";
import { useApp } from "../AppContext";
import { BrewTemperatureSchedule } from "../components/BrewTemperatureSchedule";
import { GrindDial } from "../components/GrindDial";
import { ScreenHeader } from "../components/ScreenHeader";
import { StickyActionBar } from "../components/StickyActionBar";
import {
  BREW_VARIANT_ORDER,
  BREW_VARIANTS,
  computeDose,
} from "../grindEngine";
import {
  createStartingRecipe,
  deleteBean,
  getActiveSessionForRecipe,
  getAidenProfileForBean,
  getBean,
  getPulseTemperatures,
  getRecipeForBeanVariant,
  markDialedIn,
  reopenRecipe,
  updateBean,
} from "../storage";
import type { BrewVariant, RoastLevel } from "../types";

interface Props {
  beanId: string;
}

type VariantState = "none" | "dialed" | "recheck" | "dialing";

const VARIANT_STATUS_LABELS: Record<VariantState, string> = {
  none: "Not started",
  dialed: "Dialed in",
  recheck: "Check again",
  dialing: "Dialing",
};

export function BeanDetailScreen({ beanId }: Props) {
  const { navigate, tempUnit } = useApp();
  const bean = getBean(beanId);
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
  const bump = () => setRefresh((refresh) => refresh + 1);

  if (!bean) return <div className="screen"><p>Bean not found.</p></div>;

  const recipe = getRecipeForBeanVariant(beanId, brewVariant);
  const aidenProfile = getAidenProfileForBean(beanId);
  const aidenReady = aidenProfile?.status === "ready";
  const session = recipe ? getActiveSessionForRecipe(recipe.id) : undefined;
  const lastEvent = session?.events[session.events.length - 1];
  const suggestDialed = lastEvent?.tasteResult === "just-right";
  const pulseTemps = aidenProfile
    ? getPulseTemperatures(aidenProfile, brewVariant)
    : [];
  const ratio = aidenProfile?.ratio;
  const dose = recipe && ratio ? computeDose(recipe.cups, ratio) : undefined;
  const definition = BREW_VARIANTS[brewVariant];

  function startGuidedBrew(recipeId: string, mode: "rate" | "brew") {
    if (!aidenReady) {
      navigate({ id: "aiden-profile", beanId, recipeId, mode });
      return;
    }
    navigate({ id: "guided-brew", recipeId, mode });
  }

  function startDialing() {
    const created = createStartingRecipe(bean!, brewVariant);
    startGuidedBrew(created.id, "rate");
  }

  function handleDelete() {
    deleteBean(beanId);
    navigate({ id: "home" });
  }

  function primaryAction() {
    if (!recipe) {
      startDialing();
      return;
    }
    startGuidedBrew(recipe.id, recipe.status === "dialed-in" ? "brew" : "rate");
  }

  const primaryLabel = !aidenReady
    ? aidenProfile?.status === "needs-update"
      ? "Update Aiden to brew →"
      : "Set up Aiden to brew →"
    : !recipe
      ? `Start ${definition.shortLabel.toLowerCase()} dial-in →`
      : recipe.status === "dialed-in"
        ? "Brew it ☕"
        : recipe.status === "needs-recheck"
          ? "Check brew & rate →"
          : "Brew & rate →";

  return (
    <div className="screen bean-detail has-sticky-action">
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
          <div className="tasting-notes bd-notes" aria-label="Tasting notes">
            {bean.tastingNotes.map((note) => (
              <span key={note} className="note-tag">{note}</span>
            ))}
          </div>
        )}
      </div>

      <div className="bd-baskets" role="group" aria-label="Brew size">
        {BREW_VARIANT_ORDER.map((variant) => {
          const variantDefinition = BREW_VARIANTS[variant];
          const variantRecipe = getRecipeForBeanVariant(beanId, variant);
          const state: VariantState = !variantRecipe
            ? "none"
            : variantRecipe.status === "dialed-in"
              ? "dialed"
              : variantRecipe.status === "needs-recheck"
                ? "recheck"
                : "dialing";
          return (
            <button
              key={variant}
              type="button"
              className={`bd-basket ${brewVariant === variant ? "active" : ""}`}
              onClick={() => setBrewVariant(variant)}
              aria-pressed={brewVariant === variant}
              aria-label={`${variantDefinition.label}, ${VARIANT_STATUS_LABELS[state]}`}
            >
              <span className="bd-basket-label">{variantDefinition.shortLabel}</span>
              <span className={`bd-basket-dot ${state}`} aria-hidden="true" />
              <span className="bd-basket-status">{VARIANT_STATUS_LABELS[state]}</span>
            </button>
          );
        })}
      </div>
      <p className="bd-variant-context">{definition.label} · {definition.description}</p>

      {!aidenReady && (
        <section className={`bd-aiden-card ${aidenProfile?.status ?? "needs-setup"}`}>
          <div className="bd-aiden-copy">
            <p className="screen-eyebrow">Aiden profile</p>
            <h3>{aidenProfile?.status === "needs-update" ? "Profile update required" : "Set up before brewing"}</h3>
            <p>
              {aidenProfile?.status === "needs-update"
                ? "A shared setting changed. Sync it in Fellow before your next brew."
                : "Create this bean’s profile in Fellow once, then Guided Brew is ready."}
            </p>
          </div>
          <button
            type="button"
            className="bd-aiden-open"
            onClick={() => navigate({ id: "aiden-profile", beanId })}
          >
            {aidenProfile?.status === "needs-update" ? "Update" : "Open guide"}
          </button>
        </section>
      )}

      {recipe ? (
        <>
          <div className="card bd-nextbrew">
            <div className="bd-card-top">
              <div>
                <span className="bd-card-label">Next brew</span>
                <h3 className="bd-card-title">Your target recipe</h3>
              </div>
              <button
                type="button"
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
            <div className="bd-recipe-focus">
              <div>
                <p className="bd-dial-kicker">Set Opus to</p>
                <GrindDial micron={recipe.grindMicron} size={136} />
              </div>
              <div className="bd-metrics bd-metrics-primary">
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
              </div>
            </div>
            {aidenProfile && (
              <BrewTemperatureSchedule
                basket={definition.basket}
                bloomTempF={aidenProfile.bloom.tempF}
                pulseTempsF={pulseTemps}
                tempUnit={tempUnit}
              />
            )}
          </div>

          {recipe.status === "dialed-in" ? (
            <button
              className="text-btn bd-center"
              onClick={() => {
                const reopened = reopenRecipe(recipe.id);
                if (reopened) startGuidedBrew(reopened.id, "rate");
              }}
            >
              Reopen &amp; tune
            </button>
          ) : (
            <button
              className={`mark-dialed ${suggestDialed ? "glow" : ""}`}
              onClick={() => {
                markDialedIn(recipe.id);
                bump();
              }}
            >
              ✓ Mark as dialed in
            </button>
          )}

          {session && session.events.length > 0 && (
            <button
              className="text-btn bd-center"
              onClick={() => navigate({ id: "converge", sessionId: session.id })}
            >
              View progress ({session.events.length} brew{session.events.length === 1 ? "" : "s"})
            </button>
          )}
        </>
      ) : (
        <div className="card bd-empty-basket">
          <p>
            No <strong>{definition.label.toLowerCase()}</strong> recipe yet. Dialed can create a smart starting point.
          </p>
          <button
            className="text-btn bd-center"
            onClick={() => navigate({ id: "edit-settings", beanId, brewVariant })}
          >
            Set my own starting point
          </button>
        </div>
      )}

      <details className="bd-secondary-details">
        <summary>
          <span>Bean details</span>
          <span className="bd-research-chevron" aria-hidden="true" />
        </summary>
        <div className="bd-secondary-body">
          <div className="bd-roast">
            <div className="bd-roast-head">
              <span className="bd-roast-label">Roast</span>
              {bean.initialRoast && bean.initialRoast !== bean.roast && (
                <span className="bd-roast-note">adjusted from {bean.initialRoast}</span>
              )}
            </div>
            <div className="roast-picker">
              {(["light", "medium", "dark"] as RoastLevel[]).map((roast) => (
                <button
                  key={roast}
                  type="button"
                  className={`roast-btn ${bean.roast === roast ? "active" : ""}`}
                  onClick={() => {
                    updateBean(beanId, { roast });
                    bump();
                  }}
                >
                  {roast.charAt(0).toUpperCase() + roast.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {bean.process && (
            <p className="bd-research-meta">Process · <strong>{bean.process}</strong></p>
          )}
          {bean.description && <p className="bean-description">{bean.description}</p>}
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(`${bean.roaster} ${bean.name} coffee`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bd-source"
          >
            Look up this coffee <span className="bd-source-arrow">↗</span>
          </a>
        </div>
      </details>

      {aidenReady && (
        <details className="bd-secondary-details">
          <summary>
            <span>Aiden profile ready</span>
            <span className="bd-ready-dot" aria-hidden="true" />
          </summary>
          <div className="bd-secondary-body bd-ready-profile">
            <div>
              <h3>{aidenProfile.name}</h3>
              <p>Saved in Fellow and ready for Guided Brew.</p>
            </div>
            <button type="button" onClick={() => navigate({ id: "aiden-profile", beanId })}>
              View profile
            </button>
          </div>
        </details>
      )}

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

      <StickyActionBar>
        <button className="cta-btn" onClick={primaryAction}>{primaryLabel}</button>
      </StickyActionBar>
    </div>
  );
}
