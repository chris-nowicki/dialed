import { useApp } from '../AppContext';
import { getSession, getRecipe, getBean, markDialedIn } from '../storage';
import { formatTemp } from '../grindEngine';
import { GrindDial } from '../components/GrindDial';

interface Props {
  sessionId: string;
  eventId: string;
}

export function DialInAdjustmentScreen({ sessionId, eventId }: Props) {
  const { navigate, goBack, tempUnit } = useApp();
  const session = getSession(sessionId);
  const recipe = session ? getRecipe(session.recipeId) : undefined;
  const bean = recipe ? getBean(recipe.beanId) : undefined;

  if (!session || !recipe || !bean) return <div className="screen"><p>Session not found.</p></div>;

  const event = session.events.find((e) => e.id === eventId);
  if (!event) return <div className="screen"><p>Event not found.</p></div>;

  const batchTemp = recipe.batch.pulseTempsF[0] ?? 200;
  const justRight = event.tasteResult === 'just-right';
  const tasteEmojis: Record<string, string> = {
    sour: '😬', bitter: '😤', weak: '💧', strong: '💪', 'just-right': '✨',
  };

  const goToBean = () => navigate({ id: 'bean-detail', beanId: bean.id });

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" onClick={goBack}>← Back</button>
        <h2>{justRight ? 'Nice!' : 'Next brew'}</h2>
      </header>

      <div className="card adjustment-card">
        <div className="taste-result-row">
          <span className="taste-result-emoji">{tasteEmojis[event.tasteResult]}</span>
          <span className="taste-result-label">
            {event.tasteResult.charAt(0).toUpperCase() + event.tasteResult.slice(1)}
          </span>
        </div>
        <p className="narration">{event.narration}</p>
      </div>

      {!justRight && (
        <div className="card new-settings-card">
          <h3 className="new-settings-title">Try this next time</h3>
          <GrindDial micron={recipe.grindMicron} size={140} />
          <div className="recipe-grid adj-grid">
            <div className="recipe-stat">
              <span className="stat-label">Temp</span>
              <span className="stat-value">{formatTemp(batchTemp, tempUnit)}</span>
            </div>
            <div className="recipe-stat">
              <span className="stat-label">Ratio</span>
              <span className="stat-value">1:{recipe.ratio}</span>
            </div>
            <div className="recipe-stat">
              <span className="stat-label">Dose</span>
              <span className="stat-value">{recipe.dose} g</span>
            </div>
          </div>
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
            onClick={() => navigate({ id: 'guided-brew', recipeId: recipe.id, mode: 'rate' })}
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
