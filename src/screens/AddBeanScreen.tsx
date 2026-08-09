import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { saveBean } from '../storage';
import type { RoastLevel } from '../types';

export function AddBeanScreen() {
  const { navigate, goBack } = useApp();

  const [roaster, setRoaster] = useState('');
  const [name, setName] = useState('');
  const [roast, setRoast] = useState<RoastLevel>('medium');

  function handleAddNew(e: React.FormEvent) {
    e.preventDefault();
    if (!roaster.trim() || !name.trim()) return;
    const bean = saveBean({
      roaster: roaster.trim(),
      name: name.trim(),
      roast,
      initialRoast: roast,
      tastingNotes: [],
      sourceCitations: [],
      createdBy: 'user',
      visibility: 'private',
    });
    navigate({ id: 'researching', beanId: bean.id });
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" onClick={goBack}>← Back</button>
        <h2>Add a bean</h2>
      </header>

      <form className="bean-form" onSubmit={handleAddNew}>
        <label className="field-label">
          Roaster
          <input
            className="field-input"
            type="text"
            placeholder="e.g. Counter Culture"
            value={roaster}
            onChange={(e) => setRoaster(e.target.value)}
            required
          />
        </label>
        <label className="field-label">
          Bean name
          <input
            className="field-input"
            type="text"
            placeholder="e.g. Hologram"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="field-label">
          Roast level
          <div className="roast-picker">
            {(['light', 'medium', 'dark'] as RoastLevel[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`roast-btn ${roast === r ? 'active' : ''}`}
                onClick={() => setRoast(r)}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </label>
        <button className="cta-btn" type="submit">
          Research this bean →
        </button>
      </form>
    </div>
  );
}
