import { useApp } from "../AppContext";
import { getAidenProfileForBean, getSession, getRecipe, getBean } from "../storage";
import { OPUS_V1 } from "../grindEngine";
import { ScreenHeader } from "../components/ScreenHeader";
import type { TasteResult } from "../types";

interface Props {
  sessionId: string;
}

/** Hero screen: number line showing sour/bitter bounds converging on sweet spot */
export function DialInConvergeScreen({ sessionId }: Props) {
  const { navigate, goBack } = useApp();
  const session = getSession(sessionId);
  const recipe = session ? getRecipe(session.recipeId) : undefined;
  const bean = recipe ? getBean(recipe.beanId) : undefined;
  const aidenProfile = recipe ? getAidenProfileForBean(recipe.beanId) : undefined;

  if (!session || !recipe || !bean) return <div className="screen"><p>Session not found.</p></div>;

  const grinder = OPUS_V1;
  const plottedMicrons = [
    ...session.events.map((event) => event.settings.grindMicron),
    recipe.grindMicron,
  ];
  const plotMin = Math.min(...plottedMicrons);
  const plotMax = Math.max(...plottedMicrons);
  const plotPadding = Math.max(40, (plotMax - plotMin) * 0.45);
  const rangeMin = Math.max(grinder.minMicron, plotMin - plotPadding);
  const rangeMax = Math.min(grinder.maxMicron, plotMax + plotPadding);
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

  const tasteLabels: Record<TasteResult, string> = {
    sour: "Sour",
    bitter: "Bitter",
    weak: "Weak",
    strong: "Strong",
    "just-right": "Just right",
  };

  const hasBracket = sourBound !== undefined && bitterBound !== undefined;

  return (
    <div className="screen converge-screen">
      <ScreenHeader title="Dial-in journey" context={`${bean.name} · ${session.events.length} brew${session.events.length === 1 ? "" : "s"}`} onBack={goBack} />

      <div className="converge-intro">
        <p className="screen-eyebrow">Closing in</p>
        <h2>{hasBracket ? "The sweet spot is taking shape." : "Every cup narrows the search."}</h2>
        <p>{hasBracket ? "Your sour and bitter bounds now frame the target." : "Keep tasting—Dialed is mapping the edges of this coffee."}</p>
      </div>

      <div className="card converge-card">
        <div className="converge-card-heading">
          <div>
            <p className="converge-kicker">Opus grind map</p>
            <h3 className="converge-title">Current target: {currentDial}</h3>
          </div>
          <span className="converge-brew-count">{session.events.length} tasted</span>
        </div>

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

            {session.events.map((ev, index) => (
              <div
                key={ev.id}
                className="event-dot"
                style={{
                  left: `${toPercent(ev.settings.grindMicron)}%`,
                  background: tasteColors[ev.tasteResult] ?? '#888',
                }}
                title={`Brew ${index + 1}: ${grinder.micronToDial(ev.settings.grindMicron).toFixed(2)} → ${tasteLabels[ev.tasteResult]}`}
              >
                <span>{index + 1}</span>
              </div>
            ))}
          </div>

          <div className="number-line-labels">
            <span>← Finer</span>
            <span>Coarser →</span>
          </div>

          <div className="number-line-legend" aria-label="Flavor zones">
            <span className="legend-item bitter"><i /> Bitter edge</span>
            <span className="legend-item sweet"><i /> Sweet spot</span>
            <span className="legend-item sour"><i /> Sour edge</span>
          </div>
        </div>

        {/* Iteration history */}
        <div className="iteration-history">
          <h4>Brew history</h4>
          <ul className="event-list">
            {events.map((ev, i) => (
              <li key={ev.id} className={`event-item ${i === 0 ? "latest" : ""}`}>
                <span className="event-num">{session.events.length - i}</span>
                <span className="event-details">
                  <span className="event-dial">
                    Opus {grinder.micronToDial(ev.settings.grindMicron).toFixed(2)}
                  </span>
                  <span className="event-meta">Brew #{session.events.length - i}{i === 0 ? " · latest" : ""}</span>
                </span>
                <span
                  className="event-taste"
                  style={{ color: tasteColors[ev.tasteResult] }}
                >
                  {tasteLabels[ev.tasteResult]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        className="cta-btn"
        onClick={() => {
          if (!aidenProfile || aidenProfile.status !== "ready") {
            navigate({ id: "aiden-profile", beanId: bean.id, recipeId: recipe.id, mode: "rate" });
            return;
          }
          navigate({ id: "guided-brew", recipeId: recipe.id, mode: "rate" });
        }}
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
