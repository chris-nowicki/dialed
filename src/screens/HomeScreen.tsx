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
        <div className="app-logo" aria-hidden="true">
          <svg viewBox="0 0 40 40">
            <path className="logo-bean" d="M30.7 7.8c4.7 5.2 3.1 15.5-3.7 22.3S11 38.5 6.9 33.2C2.7 27.8 4.8 17.7 11.4 11 18 4.5 26.1 2.6 30.7 7.8Z" />
            <path className="logo-seam" d="M29.3 8.9c-7.8 3.8-7.1 10.3-10.1 14.8-2.1 3.2-5.5 5.6-10.7 7.8" />
            <path className="logo-needle" d="m20 20 8.2-8.2" />
            <circle className="logo-hub" cx="20" cy="20" r="2.25" />
          </svg>
        </div>
        <h1 className="app-title">Dialed</h1>
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
        <div className="home-dial" aria-hidden="true">
          <span className="home-dial-ring" />
          <span className="home-dial-pointer" />
          <span className="home-dial-center" />
          <span className="home-dial-sweet">sweet</span>
        </div>
        {beans.length > 0 && (
          <div className="home-pulse" aria-label="Dial-in summary">
            <span><strong>{beans.length}</strong> bean{beans.length === 1 ? "" : "s"} on your bench</span>
          </div>
        )}
      </section>

      {beans.length > 0 ? (
        <>
          <h2 className="section-title">On your bench</h2>
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
