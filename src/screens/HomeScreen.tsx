import { useApp } from '../AppContext';
import { getBeans, getRecipeForBeanSize } from "../storage";
import type { Bean, BrewSize } from '../types';

type BasketState = 'none' | 'dialing' | 'dialed';

function basketState(beanId: string, brewSize: BrewSize): BasketState {
  const r = getRecipeForBeanSize(beanId, brewSize);
  if (!r) return 'none';
  return r.status === 'dialed-in' ? 'dialed' : 'dialing';
}

const CHIP_LABEL: Record<Exclude<BasketState, 'none'>, string> = {
  dialing: 'Dialing',
  dialed: 'Dialed in',
};

function BeanRow({ bean, onOpen }: { bean: Bean; onOpen: () => void }) {
  const baskets: BrewSize[] = ['single', 'batch'];
  const chips = baskets
    .map((b) => ({ b, s: basketState(bean.id, b) }))
    .filter((x) => x.s !== 'none');

  return (
    <li className="bean-item selectable" onClick={onOpen}>
      <div className="bean-name">{bean.name}</div>
      <div className="bean-meta">{bean.roaster}{bean.origin ? ` · ${bean.origin}` : ''}</div>
      <div className="bean-chips">
        {chips.length === 0 && <span className="chip chip-none">Not started</span>}
        {chips.map(({ b, s }) => (
          <span key={b} className={`chip chip-${s}`}>
            {b === 'single' ? 'Single' : 'Batch'}: {CHIP_LABEL[s as 'dialing' | 'dialed']}
          </span>
        ))}
      </div>
    </li>
  );
}

export function HomeScreen() {
  const { navigate } = useApp();
  const beans = getBeans();

  return (
    <div className="screen home-screen">
      <header className="app-header">
        <h1 className="app-title">Dialed<span>.</span></h1>
        <button
          className="settings-button"
          onClick={() => navigate({ id: "app-settings" })}
          aria-label="Open settings"
          title="Settings"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 12h2M10 12h10M4 17h7M15 17h5" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="12" r="2" />
            <circle cx="13" cy="17" r="2" />
          </svg>
        </button>
      </header>

      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-copy">
          <p className="home-eyebrow">Your dial-in coach</p>
          <h2 id="home-hero-title">Find the sweet spot.</h2>
          <p>Turn every taste into one confident adjustment for the next brew.</p>
        </div>
        <div className="home-spectrum" aria-hidden="true">
          <div className="home-spectrum-track"><span /></div>
          <div className="home-spectrum-labels">
            <span>Sour</span>
            <strong>Sweet spot</strong>
            <span>Bitter</span>
          </div>
        </div>
      </section>

      {beans.length > 0 ? (
        <>
          <h2 className="section-title">Beans</h2>
          <ul className="bean-list">
            {beans.map((bean) => (
              <BeanRow
                key={bean.id}
                bean={bean}
                onOpen={() => navigate({ id: 'bean-detail', beanId: bean.id })}
              />
            ))}
          </ul>
        </>
      ) : (
        <div className="empty-log">
          <div className="empty-log-icon">🫘</div>
          <p className="empty-log-title">No beans yet</p>
          <p className="empty-log-sub">Add a bean to start dialing in your perfect brew.</p>
        </div>
      )}

      <button className="cta-btn" onClick={() => navigate({ id: 'add-bean' })}>
        + Add bean
      </button>
    </div>
  );
}
