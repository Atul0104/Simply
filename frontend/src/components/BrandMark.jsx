import { Sparkles } from 'lucide-react';

export default function BrandMark({ compact = false, inverse = false, subtitle }) {
  return (
    <div className="brand-mark" aria-label="Perfurm">
      <span className={`brand-mark__seal ${inverse ? 'brand-mark__seal--inverse' : ''}`}>
        <Sparkles className="w-4 h-4" strokeWidth={1.6} />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className={`brand-mark__word ${inverse ? 'text-white' : ''}`}>perfurm</span>
          {subtitle && <span className={`brand-mark__subtitle ${inverse ? 'text-stone-300' : ''}`}>{subtitle}</span>}
        </span>
      )}
    </div>
  );
}
