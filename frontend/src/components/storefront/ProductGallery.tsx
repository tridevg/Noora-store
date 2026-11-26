import { useState, type MouseEvent } from 'react';
import type { ImageDto } from '@beauty-store/shared';
import { t } from '../../i18n';

/** Main image with a zoom toggle (2x, follows the pointer) and thumbnail strip. */
export function ProductGallery({ images, alt }: { images: readonly ImageDto[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const current = images[index] ?? images[0];

  if (!current) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-[1.25rem] bg-sand text-small text-ink-muted">
        {t('storefront.product.noImage')}
      </div>
    );
  }

  function follow(event: MouseEvent<HTMLDivElement>) {
    if (!zoomed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }

  return (
    <div className="space-y-3">
      <div
        onMouseMove={follow}
        className="relative aspect-[3/4] overflow-hidden rounded-[1.25rem] bg-sand"
      >
        {/* The first product image is the likely LCP element: fetched at high priority, never lazy. */}
        <img
          src={current.full_url}
          srcSet={`${current.thumb_url} 400w, ${current.full_url} 1600w`}
          sizes="(min-width: 768px) 50vw, 100vw"
          alt={current.alt_text || alt}
          width={1600}
          height={1600}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          style={zoomed ? { transform: 'scale(2)', transformOrigin: origin } : undefined}
          className={`size-full object-cover transition-transform duration-200 ${
            zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
          }`}
        />
        <button
          type="button"
          aria-pressed={zoomed}
          onClick={() => setZoomed((value) => !value)}
          className="absolute right-3 bottom-3 min-h-11 rounded-pill bg-canvas/90 px-4 text-small font-medium text-ink-primary"
        >
          {zoomed ? t('storefront.product.zoomOut') : t('storefront.product.zoomIn')}
        </button>
      </div>
      {images.length > 1 ? (
        <ul aria-label={t('storefront.product.gallery')} className="flex gap-2 overflow-x-auto">
          {images.map((image, position) => (
            <li key={image.id}>
              <button
                type="button"
                aria-label={`${position + 1} / ${images.length}`}
                aria-pressed={position === index}
                onClick={() => {
                  setIndex(position);
                  setZoomed(false);
                }}
                className={`size-16 overflow-hidden rounded-[1.25rem] border-2 ${
                  position === index ? 'border-sage-hover' : 'border-transparent'
                }`}
              >
                <img
                  src={image.thumb_url}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
