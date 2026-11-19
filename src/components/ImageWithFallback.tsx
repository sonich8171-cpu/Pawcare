import { PawPrint } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getAvatarTone, getInitials } from '../data/defaults';

interface ImageWithFallbackProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  variant?: 'media' | 'avatar' | 'pet';
  seed?: string;
  loading?: 'lazy' | 'eager';
  hoverZoom?: boolean;
}

export function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackLabel,
  variant = 'media',
  seed,
  loading = 'lazy',
  hoverZoom = false,
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setHasError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [src]);

  if (!src || hasError) {
    if (variant === 'avatar') {
      const tone = getAvatarTone(seed || fallbackLabel || alt);
      const initials = getInitials(fallbackLabel || alt);
      return (
        <div
          className={`flex items-center justify-center border font-display font-bold select-none ${tone} ${className}`}
          role="img"
          aria-label={alt}
        >
          <span className="text-sm tracking-tight">{initials}</span>
        </div>
      );
    }

    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50/60 to-violet-50/50 text-stone-500 ${className}`}
        role="img"
        aria-label={alt}
      >
        <PawPrint className="w-7 h-7 text-teal-700/60 mb-1" />
        {fallbackLabel && (
          <span className="text-xs font-medium px-3 text-center text-stone-600">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-stone-100">
      {!isLoaded && (
        <div className="absolute inset-0 photo-shimmer" aria-hidden="true" />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading={loading}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`${className} transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
          hoverZoom ? 'group-hover:scale-[1.04]' : ''
        } ${
          isLoaded
            ? 'opacity-100 scale-100 blur-0'
            : 'opacity-0 scale-[1.02] blur-[4px]'
        }`}
      />
    </div>
  );
}
