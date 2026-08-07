export default function BrandMark({ compact = false, inverse = false, subtitle }) {
  return (
    <div className="brand-mark" aria-label="RAW fragrance house">
      <span className={`brand-mark__seal overflow-hidden bg-white ${inverse ? 'brand-mark__seal--inverse' : ''}`}>
        <img src="/raw-logo.svg" alt="" className="h-9 w-9 max-w-none object-cover object-left" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className={`brand-mark__word tracking-[0.12em] ${inverse ? 'text-white' : ''}`}>RAW</span>
          {subtitle && <span className={`brand-mark__subtitle ${inverse ? 'text-stone-300' : ''}`}>{subtitle}</span>}
        </span>
      )}
    </div>
  );
}
