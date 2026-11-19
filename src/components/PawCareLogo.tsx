export function PawCareLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <svg
        width="30"
        height="30"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="36" height="36" rx="10" fill="#14532D" />
        <ellipse cx="18" cy="22.5" rx="6.5" ry="5.5" fill="#FDE68A" />
        <circle cx="11.2" cy="14.5" r="2.5" fill="#FFFFFF" />
        <circle cx="15.7" cy="11.3" r="2.5" fill="#FFFFFF" />
        <circle cx="20.7" cy="11.3" r="2.5" fill="#FFFFFF" />
        <circle cx="25" cy="14.5" r="2.4" fill="#FFFFFF" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight text-stone-900">
        Paw<span className="text-emerald-800">Care</span>
      </span>
    </span>
  );
}
