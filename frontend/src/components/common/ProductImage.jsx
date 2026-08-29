import React, { useState, useEffect } from 'react';

/**
 * Standardized Product Image Component for AVS Distributors
 * Enforces 1:1 aspect ratio, object-contain fitting (no distortion/stretching),
 * exact container sizing (48x48, 64x64, 96x96, etc.), and professional fallback
 * handling when images are missing or fail to load.
 */
export const ProductImage = ({ 
  src, 
  alt = 'Product Image', 
  size = 48, 
  icon = '📦', 
  className = '',
  containerClassName = '' 
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  // Dimension styling map for common fixed sizes or dynamic px
  const sizeStyle = {
    width: `${size}px`,
    height: `${size}px`
  };

  const isFallbackNeeded = !src || hasError;

  return (
    <div 
      style={sizeStyle}
      className={`relative aspect-square shrink-0 rounded-xl bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200/90 p-1 flex items-center justify-center overflow-hidden shadow-2xs ${containerClassName}`}
    >
      {!isFallbackNeeded ? (
        <img
          src={src}
          alt={alt}
          onError={() => setHasError(true)}
          className={`w-full h-full object-contain aspect-square drop-shadow-2xs transition-opacity duration-200 ${className}`}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400 font-sans select-none">
          <span 
            style={{ fontSize: `${Math.max(14, Math.round(size * 0.42))}px` }}
            role="img" 
            aria-label={alt}
          >
            {icon || '📦'}
          </span>
        </div>
      )}
    </div>
  );
};
