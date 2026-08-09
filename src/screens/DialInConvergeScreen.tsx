import { useApp } from '../AppContext';
import { getSession, getRecipe, getBean } from '../storage';
import { OPUS_V1 } from '../grindEngine';

interface Props {
  sessionId: string;
}

/** Hero screen: number line showing sour/bitter bounds converging on sweet spot */
export function DialInConvergeScreen({ sessionId }: Props) {
  const { navigate, goBack } = useApp();
  const session = getSession(sessionId);
  const recipe = session ? getRecipe(session.recipeId) : undefined;
  const bean = recipe ? getBean(recipe.beanId) : undefined;

  if (!session || !recipe || !bean) return <div className="screen"><p>Session not found.</p></div>;

  const grinder = OPUS_V1;
  const rangeMin = grinder.minMicron;
  const rangeMax = grinder.maxMicron;
  const rangeSpan = rangeMax - rangeMin;

  function toPercent(micron: number): number {
    return ((micron - rangeMin) / rangeSpan) * 100;
  }

  const { sourBound, bitterBound } = session;
  const currentMicron = recipe.grindMicron;
  const currentDial = grinder.micronToDial(currentMicron).toFixed(2);

  // Events for history log
  const events = session.events.slice().reverse();

  const tasteColors: Record<string, string> = {
    sour: '#f59e0b',
    bitter: '#ef4444',
    weak: '#60a5fa',
    strong: '#8b5cf6',
    'just-right': '#10b981',
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" onClick={goBack}>← Back</button>
        <h2>Convergence</h2>
      </header>

      <div className="card converge-card">
        <h3 className="converge-title">Grind Dial-In Progress</h3>
        <p className="converge-subtitle">{bean.name} · {bean.roaster}</p>

        {/* Number line */}
        <div className="number-line-container" role="img" aria-label="Grind convergence number line">
          <div className="number-line-track">
            {/* Sour zone (too coarse — left side past sour bound) */}
            {sourBound !== undefined && (
              <div
                className="zone sour-zone"
                style={{
                  left: `${toPercent(sourBound)}%`,
                  width: `${100 - toPercent(sourBound)}%`,
                }}
                title={`Sour above ${grinder.micronToDial(sourBound).toFixed(2)}`}
              />
            )}

            {/* Bitter zone (too fine — right side past bitter bound) */}
            {bitterBound !== undefined && (
              <div
                className="zone bitter-zone"
                style={{
                  left: 0,
                  width: `${toPercent(bitterBound)}%`,
                }}
                title={`Bitter below ${grinder.micronToDial(bitterBound).toFixed(2)}`}
              />
            )}

            {/* Sweet spot zone */}
            {sourBound !== undefined && bitterBound !== undefined && (
              <div
                className="zone sweet-zone"
                style={{
                  left: `${toPercent(bitterBound)}%`,
                  width: `${toPercent(sourBound) - toPercent(bitterBound)}%`,
                }}
              />
            )}

            {/* Current position marker */}
            <div
              className="current-marker"
              style={{ left: `${toPercent(currentMicron)}%` }}
              title={`Current: ${currentDial}`}
            >
              <div className="marker-line" />
              <div className="marker-label">{currentDial}</div>
            </div>

            {/* Dot for each tasted event */}
            {session.events.map((ev) => (
              <div
                key={ev.id}
                className="event-dot"
                style={{
                  left: `${toPercent(ev.grindMicron)}%`,
                  background: tasteColors[ev.tasteResult] ?? '#888',
                }}
                title={`${ev.grindDisplay} → ${ev.tasteResult}`}
              />
            ))}
          </div>

          <div className="number-line-labels">
            <span>Finer ←</span>
            <span>→ Coarser</span>
          </div>

          <div className="number-line-legend">
            {sourBound !== undefined && (
              <span className="legend-item sour">
                🟡 Sour ≥ {grinder.micronToDial(sourBound).toFixed(2)}
              </span>
            )}
            {bitterBound !== undefined && (
              <span className="legend-item bitter">
                🔴 Bitter ≤ {grinder.micronToDial(bitterBound).toFixed(2)}
              </span>
            )}
            {sourBound !== undefined && bitterBound !== undefined && (
              <span className="legend-item sweet">
                🟢 Sweet spot
              </span>
            )}
          </div>
        </div>

        {/* Iteration history */}
        <div className="iteration-history">
          <h4>Brew History</h4>
          <ul className="event-list">
            {events.map((ev, i) => (
              <li key={ev.id} className="event-item">
                <span className="event-num">#{session.events.length - i}</span>
                <span className="event-dial">Opus {ev.grindDisplay}</span>
                <span
                  className="event-taste"
                  style={{ color: tasteColors[ev.tasteResult] }}
                >
                  {ev.tasteResult}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        className="cta-btn"
        onClick={() => navigate({ id: 'guided-brew', recipeId: recipe.id, mode: 'rate' })}
      >
        Brew &amp; rate again →
      </button>
      <button
        className="secondary-btn"
        onClick={() => navigate({ id: 'bean-detail', beanId: bean.id })}
      >
        Back to bean
      </button>
    </div>
  );
}
