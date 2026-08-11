import { useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { getBean, updateBean } from "../storage";
import {
  canResearch,
  createFallbackResearch,
  researchBean,
} from "../research";
import type { ResearchOutcome, ResearchSource } from "../research";
import type { BeanResearchResult } from "../types";
import { ScreenHeader } from "../components/ScreenHeader";

interface Props {
  beanId: string;
}

type ResearchStatus =
  | "checking"
  | "setup-needed"
  | "loading"
  | "done"
  | "fallback"
  | "error";

const RESEARCH_STAGES = [
  "Finding the coffee",
  "Reading roast and origin",
  "Mapping the first recipe",
];

export function ResearchingScreen({ beanId }: Props) {
  const { navigate, goBack } = useApp();
  const bean = getBean(beanId);

  const [status, setStatus] = useState<ResearchStatus>("checking");
  const [research, setResearch] = useState<BeanResearchResult | null>(null);
  const [researchSource, setResearchSource] = useState<ResearchSource | null>(null);
  const [researchStage, setResearchStage] = useState(0);

  function applyResearch(outcome: ResearchOutcome) {
    setResearch(outcome.result);
    setResearchSource(outcome.source);
    updateBean(beanId, {
      roast: outcome.result.roast,
      origin: outcome.result.origin,
      process: outcome.result.process,
      tastingNotes: outcome.result.tastingNotes,
      description: outcome.result.description,
    });
    setStatus(outcome.source === "fallback" ? "fallback" : "done");
  }

  useEffect(() => {
    if (!bean) return;
    let cancelled = false;

    async function run() {
      setStatus("checking");
      try {
        const researchAvailable = await canResearch();
        if (cancelled) return;
        if (!researchAvailable) {
          setStatus("setup-needed");
          return;
        }

        setStatus("loading");
        const outcome = await researchBean(
          { roaster: bean!.roaster, name: bean!.name },
          bean!.roast,
        );
        if (!cancelled) applyResearch(outcome);
      } catch (error) {
        console.warn("[Dialed] Research flow error:", error);
        if (!cancelled) setStatus("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [beanId]);

  useEffect(() => {
    if (status !== "loading") {
      setResearchStage(0);
      return;
    }

    const interval = window.setInterval(() => {
      setResearchStage((stage) => Math.min(stage + 1, RESEARCH_STAGES.length - 1));
    }, 1400);

    return () => window.clearInterval(interval);
  }, [status]);

  if (!bean) return <div className="screen"><p>Bean not found.</p></div>;

  const goToBean = () => navigate({ id: "bean-detail", beanId });

  function continueWithoutResearch() {
    applyResearch(createFallbackResearch(bean!.roast));
  }

  return (
    <div className="screen research-screen">
      <ScreenHeader title="Bean research" context={`${bean.name} · ${bean.roaster}`} onBack={goBack} />

      {(status === "checking" || status === "loading") && (
        <div className="research-loading">
          <div className="research-orbit" aria-hidden="true">
            <span className="research-bean">◆</span>
            <span className="research-orbit-dot" />
          </div>
          <p className="research-loading-kicker">
            {status === "checking" ? "Connecting" : "Building your starting point"}
          </p>
          <h3>{status === "checking" ? "Checking research access…" : RESEARCH_STAGES[researchStage]}</h3>
          <p className="hint">
            {status === "checking"
              ? "Looking for the platform connection or your local backup key."
              : `Researching ${bean.name} by ${bean.roaster}.`}
          </p>
          {status === "loading" && (
            <ol className="research-stage-list" aria-label="Research progress">
              {RESEARCH_STAGES.map((stage, index) => (
                <li
                  key={stage}
                  className={index < researchStage ? "done" : index === researchStage ? "active" : ""}
                >
                  <span>{index < researchStage ? "✓" : index + 1}</span>
                  {stage}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {status === "setup-needed" && (
        <div className="research-access-card card">
          <div className="research-access-icon" aria-hidden="true">⌁</div>
          <p className="research-access-kicker">Live research is not connected</p>
          <h3>Add your backup key?</h3>
          <p className="hint">
            Open settings to connect OpenAI, or continue with a starting recipe based on the roast
            level you selected.
          </p>
          <button
            className="cta-btn research-primary-action"
            onClick={() => navigate({ id: "app-settings" })}
          >
            Open settings
          </button>
          <button className="text-btn research-skip-action" onClick={continueWithoutResearch}>
            Continue without AI
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="error-state card">
          <p>⚠️ Research hit an unexpected error.</p>
          <p className="hint">Your bean is saved. Continue with its roast-level starting point.</p>
          <button className="cta-btn" onClick={continueWithoutResearch}>Continue →</button>
        </div>
      )}

      {status === "fallback" && research && (
        <div className="research-fallback-card card">
          <span className="source-pill fallback">Roast-level fallback</span>
          <h3>Your starting point is ready</h3>
          <p>{research.description}</p>
          <button className="cta-btn" onClick={goToBean}>Continue →</button>
        </div>
      )}

      {status === "done" && research && (
        <>
          <div className="bean-card card research-result-card">
            <div className="bean-card-header">
              <h3>{bean.name}</h3>
              <span className="roast-badge">{research.roast}</span>
            </div>
            <span className="source-pill">
              {researchSource === "platform" ? "Platform research" : "Local key research"}
            </span>
            <div className="bean-card-meta">
              <span>🌍 {research.origin}</span>
              <span>⚙️ {research.process}</span>
            </div>
            {research.tastingNotes.length > 0 && (
              <div className="tasting-notes">
                {research.tastingNotes.map((note) => (
                  <span key={note} className="note-tag">{note}</span>
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
