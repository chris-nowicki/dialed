import { useApp } from '../AppContext';
import { getBeans, getRecipeForBeanSize } from '../storage';
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
  const { navigate, tempUnit, toggleTempUnit } = useApp();
  const beans = getBeans();

  return (
    <div className="screen home-screen">
      <header className="app-header">
        <div className="app-logo">☕</div>
        <h1 className="app-title">Dialed</h1>
        <button
          className="temp-toggle"
          onClick={toggleTempUnit}
          aria-label={`Switch to °${tempUnit === 'F' ? 'C' : 'F'}`}
        >
          °{tempUnit}
        </button>
      </header>

      {beans.length > 0 ? (
        <>
          <h2 className="section-title">Your beans</h2>
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
