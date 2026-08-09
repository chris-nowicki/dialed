import { OPUS_V1, formatGrind } from '../grindEngine';
import type { GrinderModel } from '../types';

interface Props {
  /** Grind in microns (preferred) — converted to the nearest dial position. */
  micron?: number;
  /** Or pass a dial value directly. */
  dial?: number;
  grinder?: GrinderModel;
  /** Rendered width/height in px. */
  size?: number;
  /** Hide the text label under the dial. */
  hideLabel?: boolean;
}

// Geometry (SVG user units)
const CENTER = 60;
const TICK_OUTER = 46;
const TICK_MAJOR_INNER = 37;
const TICK_MINOR_INNER = 42;
const NUMBER_RADIUS = 53;
const POINTER_LEN = 40;
const SWEEP = 270; // total arc degrees
const START = -SWEEP / 2; // v=min sits at -135° (bottom-left)

/** Point on a circle, angle measured clockwise from top (12 o'clock). */
function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) };
}

/**
 * The Opus grind dial as a small gauge: numbered 1–11 with 3 ticks between each
 * (41 clicks), a pointer at the current position, and an actionable label.
 */
export function GrindDial({ micron, dial, grinder = OPUS_V1, size = 132, hideLabel = false }: Props) {
  const rawDial = dial ?? (micron !== undefined ? grinder.micronToDial(micron) : grinder.dialMin);
  const { dial: snapped, label } = formatGrind(rawDial, grinder);

  const angleFor = (v: number) => START + ((v - grinder.dialMin) / (grinder.dialMax - grinder.dialMin)) * SWEEP;

  // Build tick marks across every click position.
  const ticks: React.ReactNode[] = [];
  const numbers: React.ReactNode[] = [];
  const stepCount = Math.round((grinder.dialMax - grinder.dialMin) / grinder.dialStep);
  for (let i = 0; i <= stepCount; i++) {
    const v = grinder.dialMin + i * grinder.dialStep;
    const isMajor = Math.abs(v - Math.round(v)) < 1e-9;
    const a = angleFor(v);
    const outer = polar(a, TICK_OUTER);
    const inner = polar(a, isMajor ? TICK_MAJOR_INNER : TICK_MINOR_INNER);
    ticks.push(
      <line
        key={`t${i}`}
        x1={outer.x}
        y1={outer.y}
        x2={inner.x}
        y2={inner.y}
        className={isMajor ? 'gd-tick gd-tick-major' : 'gd-tick'}
      />,
    );
    if (isMajor) {
      const p = polar(a, NUMBER_RADIUS);
      numbers.push(
        <text key={`n${i}`} x={p.x} y={p.y} className="gd-number" dominantBaseline="central" textAnchor="middle">
          {Math.round(v)}
        </text>,
      );
    }
  }

  const pointerAngle = angleFor(snapped);
  const tip = polar(pointerAngle, POINTER_LEN);

  return (
    <div className="grind-dial">
      <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={label}>
        <circle cx={CENTER} cy={CENTER} r={TICK_OUTER + 6} className="gd-face" />
        {ticks}
        {numbers}
        <line x1={CENTER} y1={CENTER} x2={tip.x} y2={tip.y} className="gd-pointer" />
        <circle cx={CENTER} cy={CENTER} r={26} className="gd-knob" />
        <circle cx={tip.x} cy={tip.y} r={3.5} className="gd-pointer-dot" />
      </svg>
      {!hideLabel && <p className="grind-dial-label">{label}</p>}
    </div>
  );
}
