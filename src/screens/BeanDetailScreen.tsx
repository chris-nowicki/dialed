import { useState } from 'react';
import { useApp } from '../AppContext';
import {
  getBean,
  updateBean,
  getRecipeForBeanSize,
  getActiveSessionForRecipe,
  createStartingRecipe,
  markDialedIn,
  reopenRecipe,
  deleteBean,
} from '../storage';
import { formatTemp, BASKET_CUPS } from '../grindEngine';
import { GrindDial } from '../components/GrindDial';
import type { BrewSize, RoastLevel } from '../types';
import { ScreenHeader } from "../components/ScreenHeader";

interface Props {
  beanId: string;
}

const BASKETS: { size: BrewSize; label: string; sub: string }[] = [
  { size: 'single', label: 'Single', sub: 'Cone · 1–3 cups' },
  { size: 'batch', label: 'Batch', sub: 'Flat · 4–10 cups' },
];

export function BeanDetailScreen({ beanId }: Props) {
  const { navigate } = useApp();
  const bean = getBean(beanId);

  // Default to the basket that already has a recipe (prefer batch).
  const initialBasket: BrewSize = getRecipeForBeanSize(beanId, 'batch')
    ? 'batch'
    : getRecipeForBeanSize(beanId, 'single')
      ? 'single'
      : 'batch';

  const [basket, setBasket] = useState<BrewSize>(initialBasket);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, setRefresh] = useState(0);
  const bump = () => setRefresh((r) => r + 1);

  if (!bean) return <div className="screen"><p>Bean not found.</p></div>;

  const recipe = getRecipeForBeanSize(beanId, basket);
  const session = recipe ? getActiveSessionForRecipe(recipe.id) : undefined;
  const lastEvent = session?.events[session.events.length - 1];
  const suggestDialed = lastEvent?.tasteResult === 'just-right';
  const temp = recipe ? recipe.batch.pulseTempsF[0] ?? 200 : 0;

  function startDialing() {
    const created = createStartingRecipe(bean!, basket);
    navigate({ id: 'guided-brew', recipeId: created.id, mode: 'rate' });
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
            {recipe?.status === "dialed-in" ? "Dialed in" : recipe ? "In progress" : "Fresh bag"}
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

      {/* Basket selector */}
      <div className="bd-baskets">
        {BASKETS.map(({ size, label, sub }) => {
          const r = getRecipeForBeanSize(beanId, size);
          const state = !r ? 'none' : r.status === 'dialed-in' ? 'dialed' : 'dialing';
          return (
            <button
              key={size}
              className={`bd-basket ${basket === size ? 'active' : ''}`}
              onClick={() => setBasket(size)}
            >
              <span className="bd-basket-label">{label}</span>
              <span className="bd-basket-sub">{sub}</span>
              <span className={`chip chip-${state}`}>
                {state === 'none' ? 'Not started' : state === 'dialed' ? 'Dialed in' : 'Dialing'}
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
                onClick={() => navigate({ id: 'edit-settings', beanId, brewSize: basket, recipeId: recipe.id })}
              >
                Edit
              </button>
            </div>
            <p className="bd-dial-kicker">Set Opus to</p>
            <GrindDial micron={recipe.grindMicron} size={148} />
            <div className="bd-metrics">
              <div className="recipe-stat">
                <span className="stat-label">Dose</span>
                <span className="stat-value">{recipe.dose} g</span>
              </div>
              <div className="recipe-stat">
                <span className="stat-label">Cups</span>
                <span className="stat-value">{recipe.cups ?? BASKET_CUPS[basket].default}</span>
              </div>
              <div className="recipe-stat">
                <span className="stat-label">Ratio</span>
                <span className="stat-value">1:{recipe.ratio}</span>
              </div>
              <div className="recipe-stat">
                <span className="stat-label">Temp</span>
                <span className="stat-value">{formatTemp(temp, 'F')}</span>
              </div>
            </div>
          </div>

          {recipe.status === 'dialed-in' ? (
            <>
              <button className="cta-btn" onClick={() => navigate({ id: 'guided-brew', recipeId: recipe.id, mode: 'brew' })}>
                Brew it ☕
              </button>
              <button
                className="text-btn bd-center"
                onClick={() => { const r = reopenRecipe(recipe.id); if (r) navigate({ id: 'guided-brew', recipeId: r.id, mode: 'rate' }); }}
              >
                Reopen & tune
              </button>
            </>
          ) : (
            <>
              <button className="cta-btn" onClick={() => navigate({ id: 'guided-brew', recipeId: recipe.id, mode: 'rate' })}>
                Brew &amp; rate →
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
          <p>You haven’t dialed in the <strong>{basket === 'single' ? 'single (cone)' : 'batch (flat)'}</strong> basket yet.</p>
          <button className="cta-btn bd-inline-cta" onClick={startDialing}>Start dialing →</button>
          <button
            className="text-btn bd-center"
            onClick={() => navigate({ id: 'edit-settings', beanId, brewSize: basket })}
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
