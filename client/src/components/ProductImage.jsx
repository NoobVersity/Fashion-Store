import { useState } from 'react';

/**
 * Product image with a local placeholder fallback, so the store keeps
 * looking right even when an external image URL fails to load.
 */
export default function ProductImage({ src, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  const url = !src || failed ? '/images/placeholder.svg' : src;
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
