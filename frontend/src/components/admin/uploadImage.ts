// Multipart POST of one product image (full + thumb) to /api/admin/products/:id/images.
// The Worker stores both blobs and the link in one D1 batch. XHR gives upload progress.
import { ApiError, CSRF_COOKIE, CSRF_HEADER, readCookie } from '../../lib/api';

export interface ImagePairFields {
  altText: string;
  sortOrder: number;
}

/** Resolves on 201; rejects with ApiError otherwise. */
export function uploadImagePair(
  productId: number,
  full: Blob,
  thumb: Blob,
  fields: ImagePairFields,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('full', full, 'full');
    form.append('thumb', thumb, 'thumb');
    form.append('alt_text', fields.altText);
    form.append('sort_order', String(fields.sortOrder));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/admin/products/${productId}/images`);
    xhr.withCredentials = true;
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) xhr.setRequestHeader(CSRF_HEADER, csrf);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status === 201) {
        onProgress(1);
        resolve();
        return;
      }
      reject(new ApiError(xhr.status, 'internal', `HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new ApiError(0, 'network', 'Network request failed'));
    xhr.send(form);
  });
}
