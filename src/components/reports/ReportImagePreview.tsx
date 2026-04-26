import { Loader2 } from 'lucide-react';

interface ReportImagePreviewProps {
  loading: boolean;
  imageUrl: string | null;
  alt: string;
  fallbackText: string;
  containerClassName?: string;
  imageClassName?: string;
}

export function ReportImagePreview({
  loading,
  imageUrl,
  alt,
  fallbackText,
  containerClassName,
  imageClassName,
}: ReportImagePreviewProps) {
  return (
    <div
      className={
        containerClassName ||
        'mx-auto flex min-h-44 w-full max-w-[220px] items-center justify-center rounded-xl border bg-muted/40 p-3'
      }
    >
      {loading ? (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className={imageClassName || 'max-h-48 w-auto max-w-full object-contain'}
        />
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {fallbackText}
        </div>
      )}
    </div>
  );
}