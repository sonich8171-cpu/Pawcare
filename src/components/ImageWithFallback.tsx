import { PawPrint } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getAvatarTone, getInitials } from '../data/defaults';

interface ImageWithFallbackProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  variant?: 'media' | 'avatar' | 'pet';
  seed?: string;
  loading?: 'lazy' | 'eager';
}

export function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackLabel,
  variant = 'media',
  seed,
  loading = 'lazy',
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
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
        <div
          className="absolute inset-0 bg-gradient-to-br from-stone-100 to-stone-200/70 animate-pulse"
          aria-hidden="true"
        />
      )}
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading={loading}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`${className} transition-opacity duration-200 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
