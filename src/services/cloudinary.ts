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

export interface CloudinaryUploadResponse {
  url: string;
  public_id?: string;
  width?: number;
  height?: number;
  format?: string;
  provider: 'cloudinary';
}

/**
 * Checks whether an image URL is hosted on Cloudinary CDN
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
 * Uploads an image (File or base64 data URL) to Cloudinary via signed direct upload.
 *
 * Returns the permanent HTTPS Cloudinary image URL to store in Firestore.
 */
export async function uploadToCloudinary(
  imageInput: File | string,
  productId?: string
): Promise<CloudinaryUploadResponse> {
  // If already an HTTP/HTTPS URL, return immediately
  if (typeof imageInput === 'string' && (imageInput.startsWith('http://') || imageInput.startsWith('https://'))) {
    return {
      url: imageInput,
      provider: 'cloudinary',
    };
  }

  // 1. Gently compress image client-side to maximum 1600px / 0.85 quality so upload payload is fast & crisp
  let dataUrl: string;
  if (typeof imageInput === 'string' && imageInput.startsWith('data:image/')) {
    dataUrl = imageInput;
  } else {
    dataUrl = await compressImage(imageInput, 1600, 1600, 0.85);
  }

  // Convert to Blob for proper binary multipart upload so Cloudinary does not treat it as a URL string
  let uploadBlob: Blob;
  const fileName = productId ? `sheet_${productId.replace(/[^a-zA-Z0-9-_]/g, '_')}.jpg` : 'sheet.jpg';
  try {
    const fetchBlobRes = await fetch(dataUrl);
    uploadBlob = await fetchBlobRes.blob();
  } catch {
    if (imageInput instanceof File) {
      uploadBlob = imageInput;
    } else {
      uploadBlob = new Blob([dataUrl], { type: 'image/jpeg' });
    }
  }

  let signErrorMsg = '';

  // 2. Primary Method: Signed direct upload via /api/cloudinary-sign
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

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (cloudRes.ok) {
        const cloudData = await cloudRes.json();
        if (cloudData.secure_url) {
          return {
            url: cloudData.secure_url,
            public_id: cloudData.public_id,
            width: cloudData.width,
            height: cloudData.height,
            format: cloudData.format,
            provider: 'cloudinary',
          };
        }
      } else {
        const cloudErrData = await cloudRes.json().catch(() => null);
        console.warn('Direct Cloudinary upload error:', cloudErrData);
        signErrorMsg = cloudErrData?.error?.message || `Cloudinary upload failed (HTTP ${cloudRes.status})`;
      }
    } else if (signData && !signData.configured) {
      signErrorMsg = signData.help || signData.error || 'Cloudinary credentials are not configured on server.';
    }
  } catch (signErr: any) {
    console.warn('Signed direct Cloudinary upload failed, trying server-side endpoint:', signErr.message);
    signErrorMsg = signErr.message;
  }

  // 3. Secondary Fallback: Server-side upload endpoint (/api/upload)
  try {
    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: dataUrl,
        productId: productId || 'sheet',
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
        provider: 'cloudinary',
      };
    } else if (uploadData?.error) {
      signErrorMsg = uploadData.error;
    }
  } catch (uploadErr: any) {
    console.warn('Server-side /api/upload failed:', uploadErr.message);
  }

  // Throw clear, actionable error
  const finalMsg = signErrorMsg || 'Cloudinary upload failed. Please ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables are set in your deployment settings.';
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
