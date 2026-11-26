import { useState } from 'react';
import type { ImageDto } from '@beauty-store/shared';
import { t } from '../../i18n';
import { ApiError, apiDelete, apiPost } from '../../lib/api';
import { describeError } from './adminErrors';
import { AdminImageError, extensionFor, toWebpVariants } from './imagePipeline';
import { Notice, dangerButtonClass, secondaryButtonClass } from './ui';
import { uploadObject } from './uploadObject';

interface Props {
  productId: number;
  images: ImageDto[];
  onChanged: () => void;
}

type Message = { tone: 'error' | 'success'; text: string } | null;

function imageErrorText(error: unknown): string {
  if (error instanceof AdminImageError) {
    switch (error.code) {
      case 'not_image':
        return t('admin.uploads.notImage');
      case 'unsupported_output':
        return t('admin.uploads.unsupportedOutput');
      case 'output_too_large':
        return t('admin.uploads.outputTooLarge');
    }
  }
  if (error instanceof ApiError && error.status === 413) return t('admin.uploads.outputTooLarge');
  if (error instanceof ApiError && error.status !== 0) return t('admin.uploads.failed');
  return describeError(error, 'admin.uploads.failed');
}

/**
 * Compresses each chosen file in the browser, uploads full and thumb to R2, then links
 * the pair to the product. Files are processed one at a time to stay within memory limits.
 */
export function ProductImageUploader({ productId, images, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    fraction: number;
  } | null>(null);
  const [message, setMessage] = useState<Message>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setBusy(true);
    setMessage(null);
    let sortOrder = images.length;
    let failures = 0;
    for (const [index, file] of list.entries()) {
      try {
        setProgress({ done: index, total: list.length, fraction: 0 });
        const { full, thumb } = await toWebpVariants(file);
        const uuid = crypto.randomUUID();
        const fullKey = `products/${productId}/${uuid}-full.${extensionFor(fullMime(full))}`;
        const thumbKey = `products/${productId}/${uuid}-thumb.${extensionFor(fullMime(thumb))}`;
        await uploadObject(fullKey, full, (fraction) =>
          setProgress({ done: index, total: list.length, fraction: fraction / 2 }),
        );
        await uploadObject(thumbKey, thumb, (fraction) =>
          setProgress({ done: index, total: list.length, fraction: 0.5 + fraction / 2 }),
        );
        await apiPost(`/api/admin/products/${productId}/images`, {
          full_r2_key: fullKey,
          thumb_r2_key: thumbKey,
          alt_text: '',
          sort_order: sortOrder,
        });
        sortOrder += 1;
      } catch (error) {
        failures += 1;
        setMessage({ tone: 'error', text: imageErrorText(error) });
      }
    }
    setProgress(null);
    setBusy(false);
    if (failures === 0) setMessage({ tone: 'success', text: t('admin.editor.imageLinked') });
    onChanged();
  }

  async function removeImage(image: ImageDto) {
    if (!window.confirm(t('admin.common.confirmDelete'))) return;
    setBusy(true);
    setMessage(null);
    try {
      await apiDelete(`/api/admin/products/${productId}/images/${image.id}`);
      setMessage({ tone: 'success', text: t('admin.editor.imageRemoved') });
      onChanged();
    } catch (error) {
      setMessage({ tone: 'error', text: describeError(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {images.length === 0 ? (
        <p className="text-small text-muted">{t('admin.editor.noImages')}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 md:grid-cols-4">
          {images.map((image) => (
            <li key={image.id} className="flex flex-col gap-2">
              <img
                src={image.thumb_url}
                alt={image.alt_text}
                loading="lazy"
                className="aspect-square w-full rounded-card border border-border object-cover"
              />
              <button
                type="button"
                className={dangerButtonClass}
                disabled={busy}
                onClick={() => void removeImage(image)}
              >
                {t('admin.editor.removeImage')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-small text-muted">{t('admin.editor.uploadHelp')}</p>
        <label
          className={`${secondaryButtonClass} cursor-pointer self-start ${busy ? 'opacity-60' : ''}`}
        >
          {t('admin.editor.uploadPick')}
          <input
            type="file"
            accept="image/jpeg,image/webp,image/*"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const files = e.target.files;
              e.target.value = '';
              void handleFiles(files);
            }}
          />
        </label>
        {progress ? (
          <div role="status" className="flex flex-col gap-1">
            <p className="text-small text-ink">
              {t('admin.editor.uploadProgress')
                .replace('{done}', String(progress.done + 1))
                .replace('{total}', String(progress.total))}
            </p>
            <progress className="w-full" max={1} value={progress.fraction} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The blob type is the decided output type; extensionFor needs it narrowed. */
function fullMime(blob: Blob): 'image/webp' | 'image/jpeg' {
  return blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
}
