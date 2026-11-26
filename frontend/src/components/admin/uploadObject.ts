// Raw PUT of one compressed image to /api/admin/uploads (schema.md). XHR gives upload progress.
import { ApiError, CSRF_COOKIE, CSRF_HEADER, readCookie } from '../../lib/api';

/** Uploads one blob under an R2 key. Resolves on 201; rejects with ApiError otherwise. */
export function uploadObject(
  key: string,
  body: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `/api/admin/uploads?key=${encodeURIComponent(key)}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', body.type);
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) xhr.setRequestHeader(CSRF_HEADER, csrf);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
        return;
      }
      reject(new ApiError(xhr.status, 'internal', `HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new ApiError(0, 'network', 'Network request failed'));
    xhr.send(body);
  });
}
