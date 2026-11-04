/**
 * Cloudinary Client Service
 *
 * Provides secure image uploads to Cloudinary:
 * 1. Primary: Secure signed direct upload (/api/cloudinary-sign) using server-side signature.
 * 2. Secondary fallback: Server-side upload endpoint (/api/upload).
 * 3. Never exposes Cloudinary API secret in browser code or public environment variables.
 * 4. Returns permanent HTTPS image URLs to store in Firestore.
 */

import { compressImage } from '../utils/imageCompressor';
import { isVideoMedia, getProductGalleryMedia, getProductMediaCounts } from '../utils/mediaHelpers';

export { isVideoMedia, getProductGalleryMedia, getProductMediaCounts };

export interface CloudinaryUploadResponse {
  url: string;
  public_id?: string;
  width?: number;
  height?: number;
  format?: string;
  resource_type?: 'image' | 'video' | string;
  provider: 'cloudinary' | 'server';
}

/**
 * Checks whether an image or video URL is hosted on Cloudinary CDN
 */
export function isCloudinaryUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('https://res.cloudinary.com/') || url.startsWith('http://res.cloudinary.com/');
}

/**
 * Checks whether Cloudinary is configured on the backend server / Vercel function
 */
export async function checkCloudinaryConfig(): Promise<{ configured: boolean; cloudName?: string; error?: string }> {
  try {
    const res = await fetch('/api/cloudinary-sign', {
      headers: { 'Cache-Control': 'no-cache' }
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.configured) {
      return { configured: true, cloudName: data.cloudName };
    }
    return {
      configured: false,
      error: data?.help || data?.error || 'Cloudinary credentials are not configured on the server.',
    };
  } catch (err: any) {
    return {
      configured: false,
      error: err.message || 'Could not connect to Cloudinary sign endpoint.',
    };
  }
}

/**
 * Uploads an image or video (File or base64 data URL) to Cloudinary via signed direct upload
 * (or falls back to permanent server storage in /uploads/).
 *
 * Returns the permanent URL to store in Firestore.
 */
export async function uploadToCloudinary(
  mediaInput: File | string,
  productId?: string
): Promise<CloudinaryUploadResponse> {
  // If already an HTTP/HTTPS URL or server /uploads/ URL, return immediately
  if (
    typeof mediaInput === 'string' &&
    (mediaInput.startsWith('http://') ||
      mediaInput.startsWith('https://') ||
      mediaInput.startsWith('/uploads/') ||
      mediaInput.startsWith('/images/'))
  ) {
    return {
      url: mediaInput.trim(),
      resource_type: isVideoMedia(mediaInput) ? 'video' : 'image',
      provider: 'cloudinary',
    };
  }

  const isVideo = isVideoMedia(mediaInput);
  const resourceType = isVideo ? 'video' : 'auto';

  let dataUrl: string | undefined;
  let uploadBlob: Blob;
  const ext = isVideo ? 'mp4' : 'jpg';
  const fileName = productId
    ? `sheet_${productId.replace(/[^a-zA-Z0-9-_]/g, '_')}_${Date.now()}.${ext}`
    : `sheet_${Date.now()}.${ext}`;

  if (isVideo) {
    if (mediaInput instanceof File) {
      uploadBlob = mediaInput;
    } else {
      const fetchBlobRes = await fetch(mediaInput);
      uploadBlob = await fetchBlobRes.blob();
    }
  } else {
    // Compress photo client-side to maximum 1600px / 0.85 quality so upload payload is fast & crisp
    if (typeof mediaInput === 'string' && mediaInput.startsWith('data:image/')) {
      dataUrl = mediaInput;
    } else {
      dataUrl = await compressImage(mediaInput, 1600, 1600, 0.85);
    }

    try {
      const fetchBlobRes = await fetch(dataUrl);
      uploadBlob = await fetchBlobRes.blob();
    } catch {
      if (mediaInput instanceof File) {
        uploadBlob = mediaInput;
      } else {
        uploadBlob = new Blob([dataUrl], { type: 'image/jpeg' });
      }
    }
  }

  let signErrorMsg = '';

  // 1. Primary Method: Signed direct upload via /api/cloudinary-sign
  try {
    const queryParam = productId ? `?productId=${encodeURIComponent(productId)}` : '';
    const signRes = await fetch(`/api/cloudinary-sign${queryParam}`, {
      headers: { 'Cache-Control': 'no-cache' }
    });

    const signData = await signRes.json().catch(() => null);

    if (signRes.ok && signData?.configured && signData?.signature && signData?.apiKey && signData?.cloudName) {
      const formData = new FormData();
      formData.append('file', uploadBlob, fileName);
      formData.append('api_key', signData.apiKey);
      formData.append('timestamp', String(signData.timestamp));
      formData.append('signature', signData.signature);
      if (signData.folder) {
        formData.append('folder', signData.folder);
      }
      if (signData.public_id) {
        formData.append('public_id', signData.public_id);
      }

      // Cloudinary upload endpoint handles both image and video
      const endpoint = `https://api.cloudinary.com/v1_1/${signData.cloudName}/${isVideo ? 'video' : 'auto'}/upload`;
      const cloudRes = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (cloudRes.ok) {
        const cloudData = await cloudRes.json();
        if (cloudData.secure_url) {
          return {
            url: cloudData.secure_url,
            public_id: cloudData.public_id,
            width: cloudData.width,
            height: cloudData.height,
            format: cloudData.format,
            resource_type: cloudData.resource_type || (isVideo ? 'video' : 'image'),
            provider: 'cloudinary',
          };
        }
      } else {
        const cloudErrData = await cloudRes.json().catch(() => null);
        console.warn('Direct Cloudinary media upload error:', cloudErrData);
        signErrorMsg = cloudErrData?.error?.message || `Cloudinary upload failed (HTTP ${cloudRes.status})`;
      }
    } else if (signData && !signData.configured) {
      signErrorMsg = signData.help || signData.error || 'Cloudinary credentials are not configured on server.';
    }
  } catch (signErr: any) {
    console.warn('Signed direct Cloudinary upload failed, trying server-side endpoint:', signErr.message);
    signErrorMsg = signErr.message;
  }

  // 2. Secondary Fallback: Direct binary stream upload (/api/upload-binary) - zero Base64 bloat, instant for videos
  try {
    const queryParams = new URLSearchParams({
      productId: productId || 'sheet',
      resource_type: isVideo ? 'video' : 'image',
      ext,
      filename: mediaInput instanceof File ? mediaInput.name : fileName,
    });
    const binRes = await fetch(`/api/upload-binary?${queryParams.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': uploadBlob.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      },
      body: uploadBlob,
    });

    const binData = await binRes.json().catch(() => null);
    if (binRes.ok && binData?.url) {
      return {
        url: binData.url,
        public_id: binData.public_id,
        width: binData.width,
        height: binData.height,
        format: binData.format,
        resource_type: binData.resource_type || (isVideo ? 'video' : 'image'),
        provider: binData.provider || 'server',
      };
    }
  } catch (binErr: any) {
    console.warn('Binary upload endpoint fallback notice:', binErr.message);
  }

  // 3. Tertiary Fallback: JSON Base64 upload endpoint (/api/upload)
  try {
    let payload = dataUrl;
    if (!payload) {
      payload = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(uploadBlob);
      });
    }

    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media: payload,
        productId: productId || 'sheet',
        resource_type: resourceType,
      }),
    });

    const uploadData = await uploadRes.json().catch(() => null);

    if (uploadRes.ok && uploadData?.url) {
      return {
        url: uploadData.url,
        public_id: uploadData.public_id,
        width: uploadData.width,
        height: uploadData.height,
        format: uploadData.format,
        resource_type: uploadData.resource_type || (isVideo ? 'video' : 'image'),
        provider: uploadData.provider || 'server',
      };
    } else if (uploadData?.error) {
      signErrorMsg = uploadData.error;
    }
  } catch (uploadErr: any) {
    console.warn('Server-side /api/upload failed:', uploadErr.message);
  }

  // Throw clear, actionable error
  const finalMsg = signErrorMsg || 'Media upload failed. Please try a smaller file or check your connection.';
  throw new Error(finalMsg);
}

/**
 * Safely deletes an old image from Cloudinary via server-side endpoint
 */
export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  if (!publicId) return false;
  try {
    const res = await fetch('/api/cloudinary-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_id: publicId }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to delete old Cloudinary image:', err);
    return false;
  }
}
