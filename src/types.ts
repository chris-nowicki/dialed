// ─── Bean ────────────────────────────────────────────────────────────────────

export type RoastLevel = 'light' | 'medium' | 'dark';
export type ProcessMethod = 'washed' | 'natural' | 'honey' | 'anaerobic' | 'other';
export type Visibility = 'private' | 'public';

export interface Bean {
  id: string;
  roaster: string;
  name: string;
  origin?: string;
  roast: RoastLevel;
  /** The roast the user picked when adding the bean (before research adjusted it) */
  initialRoast?: RoastLevel;
  process?: ProcessMethod;
  tastingNotes: string[];
  sourceCitations: string[];
  /** LLM research narrative, kept so it can be re-read later */
  description?: string;
  createdBy: string;
  visibility: Visibility;
  createdAt: string;
}

// ─── Grinder ─────────────────────────────────────────────────────────────────

export interface GrinderModel {
  id: string;
  name: string;
  minMicron: number;
  maxMicron: number;
  /** Dial step size (e.g. 0.25 for Opus V1) */
  dialStep: number;
  /** Dial min (e.g. 1.0) */
  dialMin: number;
  /** Dial max (e.g. 11.0) */
  dialMax: number;
  /** Convert a dial setting to microns */
  dialToMicron: (dial: number) => number;
  /** Convert microns to the nearest valid dial setting */
  micronToDial: (micron: number) => number;
}

// ─── Recipe ───────────────────────────────────────────────────────────────────

export type RecipeStatus = 'starting' | 'dialed-in';
export type BrewSize = 'single' | 'batch';

export interface BloomSettings {
  enabled: boolean;
  /** Fraction of dose (e.g. 2 = 2× dose weight) */
  ratio: number;
  timeSec: number;
  tempF: number;
}

export interface PulseBlock {
  numPulses: number;
  timeBetweenSec: number;
  /** Temp for each pulse in °F */
  pulseTempsF: number[];
}

export type AidenProfileStatus = "needs-setup" | "ready" | "needs-update";

export interface AidenProfile {
  id: string;
  beanId: string;
  name: string;
  baseRoast: RoastLevel;
  ratio: number;
  coldBrew: boolean;
  bloom: BloomSettings;
  singleServe: PulseBlock;
  batch: PulseBlock;
  status: AidenProfileStatus;
  confirmedAt?: string;
  confirmedSettings?: {
    ratio: number;
    coldBrew: boolean;
    bloom: BloomSettings;
    singleServe: PulseBlock;
    batch: PulseBlock;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Recipe {
  id: string;
  beanId: string;
  brewMethodId: string;
  grinderModelId: string;
  aidenProfileId?: string;
  aidenProfileName: string;
  /** e.g. 16 means 1:16 coffee-to-water */
  ratio: number;
  coldBrew: boolean;
  bloom: BloomSettings;
  singleServe: PulseBlock;
  batch: PulseBlock;
  /** Canonical grind in microns */
  grindMicron: number;
  /** Human-readable dial position, e.g. "6.25" */
  grindDisplay: string;
  /** Dose in grams */
  dose: number;
  /** Which Aiden basket this dial-in is for (cone = single, flat = batch) */
  brewSize: BrewSize;
  /** Last chosen cup count for this basket — drives dose */
  cups?: number;
  status: RecipeStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Dial-In Session ──────────────────────────────────────────────────────────

export type TasteResult = 'sour' | 'bitter' | 'weak' | 'strong' | 'just-right';

export interface TasteEvent {
  id: string;
  grindMicron: number;
  grindDisplay: string;
  tempF: number;
  ratio: number;
  tasteResult: TasteResult;
  narration: string;
  timestamp: string;
}

export interface DialInSession {
  id: string;
  recipeId: string;
  beanId: string;
  events: TasteEvent[];
  /** Coarsest micron value that tasted sour (upper bound — go finer) */
  sourBound?: number;
  /** Finest micron value that tasted bitter (lower bound — go coarser) */
  bitterBound?: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Bean Research ────────────────────────────────────────────────────────────

export interface BeanResearchResult {
  roast: RoastLevel;
  origin: string;
  process: ProcessMethod;
  tastingNotes: string[];
  sourceCitations: string[];
  /** LLM-generated narrative about the bean */
  description: string;
}

// ─── App State (navigation) ───────────────────────────────────────────────────

export type Screen =
  | { id: 'home' }
  | { id: "app-settings" }
  | { id: "aiden-profile"; beanId: string; recipeId?: string; mode?: "rate" | "brew" }
  | { id: 'add-bean' }
  | { id: 'researching'; beanId: string }
  | { id: 'bean-detail'; beanId: string }
  | { id: 'edit-settings'; beanId: string; brewSize: BrewSize; recipeId?: string }
  | { id: 'guided-brew'; recipeId: string; mode: 'rate' | 'brew' }
  | { id: 'taste'; sessionId: string }
  | { id: 'adjustment'; sessionId: string; eventId: string }
  | { id: 'converge'; sessionId: string };

export type TempUnit = 'F' | 'C';
