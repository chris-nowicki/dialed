interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  backLabel?: string;
  context?: string;
}

export function ScreenHeader({
  title,
  onBack,
  backLabel = "Go back",
  context,
}: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      <button
        className="back-btn"
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        title={backLabel}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
      </button>
      <div className="screen-header-copy">
        <h1>{title}</h1>
        {context && <p>{context}</p>}
      </div>
    </header>
  );
}
