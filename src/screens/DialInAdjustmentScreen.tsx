import { useApp } from "../AppContext";
import { getAidenProfileForBean, getSession, getRecipe, getBean, markDialedIn } from "../storage";
import { formatTemp } from "../grindEngine";
import { GrindDial } from "../components/GrindDial";
import { ScreenHeader } from "../components/ScreenHeader";

interface Props {
  sessionId: string;
  eventId: string;
}

export function DialInAdjustmentScreen({ sessionId, eventId }: Props) {
  const { navigate, goBack, tempUnit } = useApp();
  const session = getSession(sessionId);
  const recipe = session ? getRecipe(session.recipeId) : undefined;
  const bean = recipe ? getBean(recipe.beanId) : undefined;
  const aidenProfile = recipe ? getAidenProfileForBean(recipe.beanId) : undefined;

  if (!session || !recipe || !bean) return <div className="screen"><p>Session not found.</p></div>;

  const event = session.events.find((e) => e.id === eventId);
  if (!event) return <div className="screen"><p>Event not found.</p></div>;

  const batchTemp = aidenProfile?.batch.pulseTempsF[0] ?? recipe.batch.pulseTempsF[0] ?? 200;
  const currentRatio = aidenProfile?.ratio ?? recipe.ratio;
  const justRight = event.tasteResult === "just-right";
  const tasteEmojis: Record<string, string> = {
    sour: '😬', bitter: '😤', weak: '💧', strong: '💪', 'just-right': '✨',
  };

  const goToBean = () => navigate({ id: 'bean-detail', beanId: bean.id });

  function brewAgain() {
    if (!aidenProfile || aidenProfile.status !== "ready") {
      navigate({
        id: "aiden-profile",
        beanId: bean!.id,
        recipeId: recipe!.id,
        mode: "rate",
      });
      return;
    }
    navigate({ id: "guided-brew", recipeId: recipe!.id, mode: "rate" });
  }

  const changedSetting = event.grindMicron !== recipe.grindMicron
    ? {
        label: "Grind",
        before: `Opus ${event.grindDisplay}`,
        after: `Opus ${recipe.grindDisplay}`,
      }
    : event.ratio !== currentRatio
      ? {
          label: "Ratio",
          before: `1:${event.ratio}`,
          after: `1:${currentRatio}`,
        }
      : event.tempF !== batchTemp
        ? {
            label: "Temperature",
            before: formatTemp(event.tempF, tempUnit),
            after: formatTemp(batchTemp, tempUnit),
          }
        : null;

  return (
    <div className={`screen adjustment-screen ${justRight ? "is-success" : ""}`}>
      <ScreenHeader
        title={justRight ? "Sweet spot found" : "Your next move"}
        context={`${bean.name} · Brew #${session.events.findIndex((item) => item.id === eventId) + 1}`}
        onBack={goBack}
      />

      {justRight && (
        <div className="success-burst" aria-hidden="true">
          <span>✦</span><span>✧</span><span>✦</span>
        </div>
      )}

      <div className="card adjustment-card">
        <div className="taste-result-row">
          <span className="taste-result-emoji">{tasteEmojis[event.tasteResult]}</span>
          <span className="taste-result-label">
            {event.tasteResult.charAt(0).toUpperCase() + event.tasteResult.slice(1)}
          </span>
        </div>
        <div>
          <p className="adjustment-kicker">You tasted</p>
          <p className="narration">{event.narration}</p>
        </div>
      </div>

      {!justRight && (
        <div className="card new-settings-card">
          <div className="adjustment-heading">
            <div>
              <p className="screen-eyebrow">One confident change</p>
              <h3 className="new-settings-title">Try this next time</h3>
            </div>
            <span className="adjustment-count">1 variable</span>
          </div>
          {changedSetting && (
            <div className="setting-change" aria-label={`${changedSetting.label} changed from ${changedSetting.before} to ${changedSetting.after}`}>
              <span className="setting-change-label">{changedSetting.label}</span>
              <span className="setting-change-value old">{changedSetting.before}</span>
              <span className="setting-change-arrow">→</span>
              <span className="setting-change-value new">{changedSetting.after}</span>
            </div>
          )}
          <GrindDial micron={recipe.grindMicron} size={140} />
          <div className="recipe-grid adj-grid">
            <div className="recipe-stat">
              <span className="stat-label">Temp</span>
              <span className="stat-value">{formatTemp(batchTemp, tempUnit)}</span>
            </div>
            <div className="recipe-stat">
              <span className="stat-label">Ratio</span>
              <span className="stat-value">1:{currentRatio}</span>
            </div>
            <div className="recipe-stat">
              <span className="stat-label">Dose</span>
              <span className="stat-value">{recipe.dose} g</span>
            </div>
          </div>
        </div>
      )}

      {aidenProfile?.status === "needs-update" && (
        <div className="card adjustment-profile-update">
          <div>
            <p className="screen-eyebrow">Fellow update required</p>
            <h3>Sync the profile before brewing.</h3>
          </div>
          <p>The ratio or temperature changed, so the saved Aiden profile needs the new value.</p>
          <button type="button" onClick={brewAgain}>Open update guide →</button>
        </div>
      )}

      {session.events.length >= 2 && (
        <button className="text-btn" onClick={() => navigate({ id: 'converge', sessionId })}>
          📊 View progress
        </button>
      )}

      {justRight ? (
        <>
          <button
            className="cta-btn"
            onClick={() => { markDialedIn(recipe.id); goToBean(); }}
          >
            ✓ Mark as dialed in
          </button>
          <button className="secondary-btn" onClick={goToBean}>Keep tuning</button>
        </>
      ) : (
        <>
          <button
            className="cta-btn"
            onClick={brewAgain}
          >
            Brew again now →
          </button>
          <button className="secondary-btn" onClick={goToBean}>
            Done for now — I’ll brew later
          </button>
        </>
      )}
    </div>
  );
}
