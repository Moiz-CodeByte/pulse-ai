import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { parseDiagnosisDetails } from '@/lib/reportAnalysis';

export const MRI_IMAGES_BUCKET = 'mri-images';

const PDF_MARGIN = 40;
const PDF_LINE_HEIGHT = 14;
const PDF_CONTENT_TOP = 108;
const PDF_CONTENT_BOTTOM = 44;

const BRAND_PRIMARY = [220, 38, 38] as const;
const BRAND_PRIMARY_SOFT = [254, 242, 242] as const;
const BRAND_TEXT = [17, 24, 39] as const;
const BRAND_MUTED = [107, 114, 128] as const;
const BRAND_BORDER = [229, 231, 235] as const;

export interface MRIReportPdfInput {
  reportId: string;
  fileName: string;
  fileReference?: string | null;
  createdAt?: string | null;
  status?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  riskLevel?: string | null;
  confidence?: number | null;
  details?: string | null;
}

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

function sanitizeDownloadFileName(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || 'mri-report';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Unable to read image data for the PDF export.'));
    };

    reader.onerror = () => reject(reader.error ?? new Error('Unable to read image data for the PDF export.'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load the report image for the PDF export.'));
    image.src = dataUrl;
  });
}

function ensurePdfSpace(doc: jsPDF, currentY: number, requiredHeight: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();

  if (currentY + requiredHeight <= pageHeight - PDF_CONTENT_BOTTOM) {
    return currentY;
  }

  doc.addPage();
  return PDF_CONTENT_TOP;
}

function getDiagnosisDetailParagraphs(details: string | null | undefined): string[] {
  const parsed = parseDiagnosisDetails(details);

  if (!parsed) {
    return [];
  }

  const sections = parsed.sections?.flatMap((section) => [section.title, section.body]) ?? [];
  return sections.length ? sections : parsed.summaryText ?? [];
}

function drawPdfBranding(doc: jsPDF, pageNumber: number, totalPages: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const headerX = PDF_MARGIN;
  const headerY = 24;
  const headerWidth = pageWidth - PDF_MARGIN * 2;
  const headerHeight = 54;

  doc.setFillColor(...BRAND_PRIMARY_SOFT);
  doc.roundedRect(headerX, headerY, headerWidth, headerHeight, 16, 16, 'F');

  doc.setFillColor(...BRAND_PRIMARY);
  doc.roundedRect(headerX, headerY, 170, headerHeight, 16, 16, 'F');

  doc.setFillColor(255, 255, 255);
  doc.circle(headerX + 24, headerY + headerHeight / 2, 11, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BRAND_PRIMARY);
  doc.text('P', headerX + 20.4, headerY + headerHeight / 2 + 4.5);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('Pulse AI', headerX + 42, headerY + 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Heart Disease Detection System', headerX + 42, headerY + 38);

  doc.setTextColor(...BRAND_PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Clinical Report Export', headerX + headerWidth - 14, headerY + 21, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('AI-assisted cardiac MRI summary', headerX + headerWidth - 14, headerY + 36, { align: 'right' });

  doc.setDrawColor(...BRAND_BORDER);
  doc.line(PDF_MARGIN, pageHeight - 30, pageWidth - PDF_MARGIN, pageHeight - 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_MUTED);
  doc.text('Generated by Pulse AI', PDF_MARGIN, pageHeight - 16);
  doc.text('Confidential medical report', pageWidth / 2, pageHeight - 16, { align: 'center' });
  doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - PDF_MARGIN, pageHeight - 16, { align: 'right' });
}

async function loadPdfImage(fileReference: string | null | undefined) {
  const signedUrl = await createMRISignedUrl(fileReference);

  if (!signedUrl) {
    return null;
  }

  const response = await fetch(signedUrl);

  if (!response.ok) {
    return null;
  }

  const blob = await response.blob();

  if (!blob.type.startsWith('image/')) {
    return null;
  }

  const format = blob.type.includes('png') ? 'PNG' : blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'JPEG' : null;

  if (!format) {
    return null;
  }

  const dataUrl = await blobToDataUrl(blob);
  const image = await loadImage(dataUrl);

  return {
    dataUrl,
    format,
    width: image.width,
    height: image.height,
  };
}

export async function downloadMRIReportPdf(input: MRIReportPdfInput): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  let currentY = PDF_CONTENT_TOP;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...BRAND_TEXT);
  doc.text('MRI Report Summary', PDF_MARGIN, currentY);
  currentY += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_MUTED);
  doc.text(`Generated on ${new Date().toLocaleString()}`, PDF_MARGIN, currentY);
  currentY += 22;

  doc.setDrawColor(...BRAND_BORDER);
  doc.line(PDF_MARGIN, currentY - 6, pageWidth - PDF_MARGIN, currentY - 6);
  currentY += 8;

  doc.setTextColor(...BRAND_TEXT);
  doc.setFontSize(11);

  const metadataRows = [
    ['Report ID', input.reportId],
    ['File Name', input.fileName],
    input.createdAt ? ['Created At', new Date(input.createdAt).toLocaleString()] : null,
    input.status ? ['Status', input.status] : null,
    input.patientName ? ['Patient', input.patientName] : null,
    input.patientId ? ['Patient ID', input.patientId] : null,
    input.riskLevel ? ['Risk Level', input.riskLevel] : null,
    typeof input.confidence === 'number' ? ['Confidence', `${input.confidence}%`] : null,
  ].filter(Boolean) as Array<[string, string]>;

  for (const [label, value] of metadataRows) {
    currentY = ensurePdfSpace(doc, currentY, 18);

    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, PDF_MARGIN, currentY);

    doc.setFont('helvetica', 'normal');
    const wrappedValue = doc.splitTextToSize(value, contentWidth - 96);
    doc.text(wrappedValue, PDF_MARGIN + 96, currentY);
    currentY += Math.max(18, wrappedValue.length * PDF_LINE_HEIGHT);
  }

  const pdfImage = await loadPdfImage(input.fileReference);

  if (pdfImage) {
    const maxImageWidth = contentWidth;
    const maxImageHeight = 180;
    const scale = Math.min(maxImageWidth / pdfImage.width, maxImageHeight / pdfImage.height, 1);
    const renderWidth = pdfImage.width * scale;
    const renderHeight = pdfImage.height * scale;

    currentY = ensurePdfSpace(doc, currentY + 8, renderHeight + 28);
    doc.setFont('helvetica', 'bold');
    doc.text('MRI Scan Image', PDF_MARGIN, currentY);
    currentY += 12;

    doc.addImage(
      pdfImage.dataUrl,
      pdfImage.format,
      PDF_MARGIN + (contentWidth - renderWidth) / 2,
      currentY,
      renderWidth,
      renderHeight,
    );

    currentY += renderHeight + 20;
  }

  const detailParagraphs = getDiagnosisDetailParagraphs(input.details);

  if (detailParagraphs.length) {
    currentY = ensurePdfSpace(doc, currentY, 24);
    doc.setFont('helvetica', 'bold');
    doc.text('Analysis Details', PDF_MARGIN, currentY);
    currentY += 16;

    doc.setFont('helvetica', 'normal');

    for (const paragraph of detailParagraphs) {
      const wrappedParagraph = doc.splitTextToSize(paragraph || ' ', contentWidth);

      for (const line of wrappedParagraph) {
        currentY = ensurePdfSpace(doc, currentY, PDF_LINE_HEIGHT + 2);
        doc.text(line, PDF_MARGIN, currentY);
        currentY += PDF_LINE_HEIGHT;
      }

      currentY += 4;
    }
  }

  const totalPages = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    drawPdfBranding(doc, pageNumber, totalPages);
  }

  doc.save(`${sanitizeDownloadFileName(input.fileName)}-report.pdf`);
}
