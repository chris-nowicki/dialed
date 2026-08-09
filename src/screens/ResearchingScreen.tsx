import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { getBean, updateBean } from '../storage';
import { researchBean } from '../research';
import type { BeanResearchResult } from '../types';

interface Props {
  beanId: string;
}

export function ResearchingScreen({ beanId }: Props) {
  const { navigate, goBack } = useApp();
  const bean = getBean(beanId);

  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [research, setResearch] = useState<BeanResearchResult | null>(null);

  useEffect(() => {
    if (!bean) return;
    let cancelled = false;

    async function run() {
      setStatus('loading');
      try {
        const result = await researchBean(
          { roaster: bean!.roaster, name: bean!.name },
          bean!.roast,
        );
        if (cancelled) return;
        setResearch(result);
        updateBean(beanId, {
          roast: result.roast,
          origin: result.origin,
          process: result.process,
          tastingNotes: result.tastingNotes,
          description: result.description,
        });
        setStatus('done');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    void run();
    return () => { cancelled = true; };
  }, [beanId]);

  if (!bean) return <div className="screen"><p>Bean not found.</p></div>;

  const goToBean = () => navigate({ id: 'bean-detail', beanId });

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" onClick={goBack}>← Back</button>
        <h2>Bean research</h2>
      </header>

      {status === 'loading' && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Researching <strong>{bean.name}</strong> by {bean.roaster}…</p>
          <p className="hint">Checking roast, origin, tasting notes…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="error-state card">
          <p>⚠️ Research unavailable — no worries.</p>
          <p className="hint">We’ll start from the roast level alone. The taste loop gets you there.</p>
          <button className="cta-btn" onClick={goToBean}>Continue →</button>
        </div>
      )}

      {status === 'done' && research && (
        <>
          <div className="bean-card card">
            <div className="bean-card-header">
              <h3>{bean.name}</h3>
              <span className="roast-badge">{research.roast}</span>
            </div>
            <div className="bean-card-meta">
              <span>🌍 {research.origin}</span>
              <span>⚙️ {research.process}</span>
            </div>
            {research.tastingNotes.length > 0 && (
              <div className="tasting-notes">
                {research.tastingNotes.map((n) => (
                  <span key={n} className="note-tag">{n}</span>
                ))}
              </div>
            )}
            {research.description && (
              <p className="bean-description">{research.description}</p>
            )}
          </div>

          <div className="card honesty-note">
            <p>
              <strong>Note:</strong> Grind numbers are a smart starting guess based on public specs.
              They vary unit-to-unit. The taste loop is how we close that gap.
            </p>
          </div>

          <button className="cta-btn" onClick={goToBean}>Continue →</button>
        </>
      )}
    </div>
  );
}
