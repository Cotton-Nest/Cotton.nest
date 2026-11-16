import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  DEFAULT_SHEET_IMAGE,
  PRODUCT_DEFAULT_IMAGES,
  getCloudinarySrcSet,
  getLocalImageVariants,
  isCloudinaryImageUploadUrl,
  optimizeCloudinaryImageUrl,
  resolveBedsheetImage,
} from '../utils/imageUrl';

export interface OptimizedPictureProps {
  src?: string | null;
  alt: string;
  productId?: string;
  updatedAt?: number;
  sizes?: string;
  targetWidth?: number;
  cloudinaryWidths?: number[];
  width?: number | string;
  height?: number | string;
  className?: string;
  pictureClassName?: string;
  style?: React.CSSProperties;
  loading?: 'eager' | 'lazy';
  decoding?: 'sync' | 'async' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  draggable?: boolean;
  imgRef?: React.Ref<HTMLImageElement>;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  onError?: React.ReactEventHandler<HTMLImageElement>;
}

function forwardRef(ref: React.Ref<HTMLImageElement> | undefined, el: HTMLImageElement | null) {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(el);
  } else {
    (ref as React.MutableRefObject<HTMLImageElement | null>).current = el;
  }
}

/**
 * Responsive <picture> image wrapper engineered specifically for React 19:
 * - React 19's completeWork sets `img[src]` while <img> is detached before appending into <picture>,
 *   causing Chromium to preload the fallback `.jpg` even when `<source type="image/webp">` is present.
 * - By omitting initial detached `src` when `<source>` is active and assigning `img.src = fallbackSrc`
 *   strictly after `img.parentElement?.tagName === 'PICTURE'` inside commit phase, Chromium evaluates
 *   the responsive WebP/Cloudinary `<source srcset sizes>` first and never wastes bandwidth on `.jpg`.
 */
export const OptimizedPicture: React.FC<OptimizedPictureProps> = ({
  src,
  alt,
  productId,
  updatedAt,
  sizes,
  targetWidth = 650,
  cloudinaryWidths = [400, 650, 960],
  width,
  height,
  className,
  pictureClassName = 'contents',
  style,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority,
  referrerPolicy,
  draggable,
  imgRef,
  onLoad,
  onError,
}) => {
  const internalRef = useRef<HTMLImageElement | null>(null);
  const resolved = resolveBedsheetImage(src, productId, updatedAt);
  const [fallbackOverride, setFallbackOverride] = useState<string | null>(null);

  useEffect(() => {
    setFallbackOverride(null);
  }, [resolved]);

  const activeSourceUrl = fallbackOverride ?? resolved;
  const localVariants = fallbackOverride ? null : getLocalImageVariants(activeSourceUrl);
  const isLocalWebpPicture = Boolean(localVariants?.isKnownLocalAsset && localVariants.webpSrcSet);
  const isCloudPicture = !fallbackOverride && isCloudinaryImageUploadUrl(activeSourceUrl);

  const cloudinarySrcSet = isCloudPicture
    ? getCloudinarySrcSet(activeSourceUrl, cloudinaryWidths)
    : undefined;

  const fallbackSrc = isLocalWebpPicture && localVariants
    ? localVariants.fallbackSrc
    : isCloudPicture
    ? optimizeCloudinaryImageUrl(activeSourceUrl, targetWidth)
    : activeSourceUrl;

  const hasPictureSources = Boolean(isLocalWebpPicture || cloudinarySrcSet);

  const assignPictureImgSrc = useCallback(
    (el: HTMLImageElement | null) => {
      if (!el) return;
      if (hasPictureSources && el.parentElement?.tagName === 'PICTURE') {
        if (el.getAttribute('src') !== fallbackSrc) {
          el.src = fallbackSrc;
        }
      }
    },
    [fallbackSrc, hasPictureSources]
  );

  const handleAttachRef = useCallback(
    (el: HTMLImageElement | null) => {
      internalRef.current = el;
      assignPictureImgSrc(el);
      forwardRef(imgRef, el);
    },
    [assignPictureImgSrc, imgRef]
  );

  useLayoutEffect(() => {
    assignPictureImgSrc(internalRef.current);
  }, [assignPictureImgSrc]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const catalogFallback = (productId && PRODUCT_DEFAULT_IMAGES[productId]) || DEFAULT_SHEET_IMAGE;
      if (fallbackOverride !== catalogFallback && fallbackSrc !== catalogFallback) {
        setFallbackOverride(catalogFallback);
      }
      onError?.(e);
    },
    [fallbackOverride, fallbackSrc, onError, productId]
  );

  if (!hasPictureSources) {
    return (
      <img
        ref={handleAttachRef}
        src={fallbackSrc}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        referrerPolicy={referrerPolicy}
        draggable={draggable}
        style={style}
        className={className}
        onLoad={onLoad}
        onError={handleError}
      />
    );
  }

  return (
    <picture className={pictureClassName}>
      {isLocalWebpPicture && localVariants?.webpSrcSet && (
        <source type="image/webp" srcSet={localVariants.webpSrcSet} sizes={sizes} />
      )}
      {cloudinarySrcSet && (
        <source srcSet={cloudinarySrcSet} sizes={sizes} />
      )}
      <img
        ref={handleAttachRef}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        referrerPolicy={referrerPolicy}
        draggable={draggable}
        style={style}
        className={className}
        onLoad={onLoad}
        onError={handleError}
      />
    </picture>
  );
};
