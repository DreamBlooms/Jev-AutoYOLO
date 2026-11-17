export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="AutoYOLO" fill="none">
      <g stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" shapeRendering="geometricPrecision">
        <path d="M20 14h30v30H20z" opacity=".48" />
        <path d="M12 22h30v30H12z" />
        <path d="M12 22l8-8M42 22l8-8M42 52l8-8M12 52l8-8" opacity=".65" />
      </g>
      <g stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" shapeRendering="geometricPrecision">
        <path d="M12 31V22h9" />
        <path d="M33 22h9v9" />
        <path d="M42 43v9h-9" />
        <path d="M21 52h-9v-9" />
      </g>
    </svg>
  );
}
