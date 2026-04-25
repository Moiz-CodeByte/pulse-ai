import { supabase } from '@/integrations/supabase/client';

export const MRI_IMAGES_BUCKET = 'mri-images';

export function normalizeSingleRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
}

export function extractMRIStoragePath(fileReference: string | null | undefined): string | null {
  if (!fileReference) {
    return null;
  }

  if (!/^https?:\/\//i.test(fileReference)) {
    return fileReference;
  }

  try {
    const url = new URL(fileReference);
    const pathPrefixes = [
      `/storage/v1/object/public/${MRI_IMAGES_BUCKET}/`,
      `/storage/v1/object/sign/${MRI_IMAGES_BUCKET}/`,
      `/storage/v1/object/authenticated/${MRI_IMAGES_BUCKET}/`,
    ];

    for (const prefix of pathPrefixes) {
      const prefixIndex = url.pathname.indexOf(prefix);
      if (prefixIndex !== -1) {
        return decodeURIComponent(url.pathname.slice(prefixIndex + prefix.length));
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function createMRISignedUrl(
  fileReference: string | null | undefined,
  expiresIn = 60 * 60,
): Promise<string | null> {
  if (!fileReference) {
    return null;
  }

  const storagePath = extractMRIStoragePath(fileReference);

  if (!storagePath) {
    return /^https?:\/\//i.test(fileReference) ? fileReference : null;
  }

  const { data, error } = await supabase.storage
    .from(MRI_IMAGES_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}