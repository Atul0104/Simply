export default function BottleLoader({ label = 'Composing your experience', compact = false }) {
  return (
    <div className={`bottle-loader ${compact ? 'bottle-loader--compact' : ''}`} role="status" aria-live="polite">
      <div className="bottle-loader__scene" aria-hidden="true">
        <span className="bottle-loader__aura" />
        <span className="bottle-loader__cap" />
        <span className="bottle-loader__neck" />
        <span className="bottle-loader__bottle">
          <span className="bottle-loader__liquid">
            <span className="bottle-loader__wave" />
            <span className="bottle-loader__bubble bottle-loader__bubble--one" />
            <span className="bottle-loader__bubble bottle-loader__bubble--two" />
            <span className="bottle-loader__bubble bottle-loader__bubble--three" />
          </span>
          <span className="bottle-loader__shine" />
          <span className="bottle-loader__label">P</span>
        </span>
      </div>
      <p className="bottle-loader__copy">{label}</p>
      <span className="sr-only">Loading</span>
    </div>
  );
}
