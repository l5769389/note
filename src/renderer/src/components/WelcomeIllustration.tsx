export function WelcomeIllustration() {
  return (
    <div className="welcome-illustration" aria-hidden="true">
      <div className="welcome-sheet welcome-sheet-back">
        <span />
      </div>
      <div className="welcome-sheet">
        <strong>#</strong>
        <span />
        <span />
        <span />
      </div>
      <div className="welcome-markdown-badge">M↓</div>
      <div className="welcome-code-badge">{"</>"}</div>
      <div className="welcome-pen" />
    </div>
  );
}
