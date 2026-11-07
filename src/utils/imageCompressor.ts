/**
 * Compresses an image file or data URL to high-quality JPEG
 * with a maximum dimension (default 1280px) and quality 0.82.
 * Reduces 5MB-15MB phone photos down to ~80KB-160KB for instant
 * multi-device synchronization and zero localStorage quota issues.
 */
export async function compressImage(
  input: File | string,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let rawDataUrlFallback = typeof input === 'string' ? input : '';

    const finishResolve = (val: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(val);
    };

    const finishReject = (err: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (rawDataUrlFallback) {
        resolve(rawDataUrlFallback);
      } else {
        reject(err);
      }
    };

    const timer = setTimeout(() => {
      if (!settled && rawDataUrlFallback) {
        finishResolve(rawDataUrlFallback);
      }
    }, 1500);

    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width || 1);
      canvas.height = Math.max(1, height || 1);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        finishResolve(rawDataUrlFallback);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      try {
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        finishResolve(compressedDataUrl || rawDataUrlFallback);
      } catch (e) {
        finishReject(e);
      }
    };

    img.onerror = (err) => {
      finishReject(err);
    };

    if (typeof input === 'string') {
      if (input.startsWith('http://') || input.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }
      img.src = input;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          rawDataUrlFallback = reader.result;
          // If file is already compact (< 500KB), skip canvas re-encoding for instant upload
          if (input.size <= 500 * 1024) {
            finishResolve(reader.result);
            return;
          }
          img.src = reader.result;
        } else {
          finishReject(new Error('Failed to read file'));
        }
      };
      reader.onerror = finishReject;
      reader.readAsDataURL(input);
    }
  });
}
