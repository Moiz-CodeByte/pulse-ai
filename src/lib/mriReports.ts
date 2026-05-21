import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { parseDiagnosisDetails } from '@/lib/reportAnalysis';
import { getPatientFirstName } from '@/lib/caseLabels';

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
const BRAND_SURFACE = [249, 250, 251] as const;
const PULSE_AI_LOGO_SVG = `
<svg viewBox="-51.2 -51.2 614.40 614.40" xmlns="http://www.w3.org/2000/svg">
  <g fill="#dc2626">
    <path d="M222.717,366.95c-5.752,0-11.078-3.24-13.692-8.463l-41.575-83.069l-23.142,35.614 c-2.826,4.347-7.659,6.971-12.844,6.971H15.318C6.858,318.002,0,311.144,0,302.684s6.858-15.318,15.318-15.318h107.833 l33.184-51.067c2.993-4.604,8.232-7.242,13.703-6.948c5.484,0.308,10.381,3.528,12.839,8.438l35.382,70.697l35.928-136.243 c1.659-6.289,7.109-10.846,13.593-11.363c6.475-0.519,12.588,3.117,15.223,9.063l26.233,59.206l22.079-34.224 c2.802-4.341,7.602-6.979,12.769-7.014c5.24-0.052,10.002,2.538,12.862,6.841l22.964,34.573h116.773 c8.46,0,15.318,6.858,15.318,15.318s-6.858,15.318-15.318,15.318H371.695c-5.131,0-9.921-2.569-12.76-6.842l-14.562-21.924 l-24.776,38.406c-3.051,4.73-8.457,7.408-14.065,6.968c-5.612-0.438-10.531-3.92-12.812-9.066l-20.043-45.236l-35.143,133.27 c-1.625,6.162-6.896,10.675-13.234,11.33C223.769,366.922,223.242,366.95,222.717,366.95z"/>
    <path d="M247.875,478.107c-2.226,0-4.453-0.484-6.516-1.455c-73.068-34.345-146.415-97.757-191.42-165.49 c-3.125-4.701-3.41-10.741-0.741-15.716c2.667-4.975,7.855-8.079,13.499-8.079h60.454l33.184-51.068 c2.992-4.604,8.227-7.256,13.703-6.948c5.484,0.308,10.381,3.528,12.839,8.438l35.382,70.697l35.928-136.243 c1.659-6.289,7.109-10.846,13.593-11.363c6.475-0.519,12.588,3.117,15.223,9.063l26.233,59.206l22.079-34.224 c2.802-4.341,7.602-6.979,12.769-7.014c0.034,0,0.069,0,0.103,0c5.128,0,9.92,2.567,12.76,6.842l27.509,41.416 c4.681,7.048,2.763,16.554-4.283,21.235c-7.049,4.68-16.555,2.762-21.235-4.283l-14.564-21.924l-24.775,38.406 c-3.053,4.73-8.466,7.408-14.065,6.968c-5.612-0.438-10.531-3.92-12.812-9.067l-20.043-45.236l-35.143,133.27 c-1.625,6.162-6.896,10.675-13.234,11.33c-6.349,0.651-12.423-2.682-15.275-8.38l-41.575-83.069l-23.142,35.614 c-2.826,4.347-7.659,6.971-12.844,6.971H92.704c40.558,51.659,98.551,99.672,155.172,127.775 c52.656-26.141,107.401-69.974,147.65-118.421c5.407-6.508,15.062-7.4,21.57-1.994c6.507,5.406,7.4,15.063,1.994,21.57 C374.449,400.67,312.88,449.161,254.392,476.653C252.328,477.623,250.1,478.107,247.875,478.107z"/>
    <path fill-opacity="0.15" d="M169.179,244.646l53.544,106.986l46.275-175.482l37.727,85.149l37.461-58.069l27.51,41.416h91.694 c3.762-10.019,6.72-20.013,8.743-29.903c2.085-10.218,3.215-20.38,3.215-30.324c0-74.655-59.694-135.207-133.342-135.207 c-36.73,0-69.986,15.082-94.132,39.444c-24.145-24.363-57.401-39.444-94.132-39.444c-73.646,0-133.342,60.552-133.342,135.207 c0,9.944,1.13,20.106,3.215,30.324c5.946,29.077,19.87,59.031,39.08,87.943h68.767L169.179,244.646z"/>
    <path d="M222.717,366.95c-5.752,0-11.078-3.24-13.692-8.461l-41.575-83.069l-23.142,35.614 c-2.826,4.347-7.659,6.971-12.844,6.971H62.697c-5.13,0-9.92-2.567-12.758-6.841c-21.318-32.081-35.221-63.49-41.329-93.35 c-2.339-11.474-3.525-22.707-3.525-33.394c0-83,66.688-150.525,148.659-150.525c34.693,0,67.609,11.981,94.132,34.011 c26.523-22.03,59.439-34.011,94.132-34.011c81.971,0,148.658,67.525,148.658,150.525c0,10.692-1.186,21.924-3.523,33.386 c-2.134,10.434-5.3,21.275-9.411,32.225c-2.242,5.975-7.958,9.933-14.34,9.933h-91.695c-5.131,0-9.921-2.569-12.76-6.842 l-14.563-21.924l-24.776,38.406c-3.051,4.73-8.457,7.408-14.065,6.968c-5.612-0.438-10.531-3.92-12.812-9.067l-20.043-45.236 l-35.143,133.27c-1.625,6.162-6.896,10.675-13.234,11.33C223.769,366.922,223.241,366.95,222.717,366.95z M169.177,229.328 c0.286,0,0.573,0.008,0.861,0.025c5.484,0.308,10.381,3.528,12.839,8.438l35.382,70.697l35.928-136.243 c1.659-6.289,7.109-10.846,13.593-11.363c6.475-0.519,12.588,3.117,15.223,9.063l26.233,59.206l22.079-34.224 c2.802-4.341,7.602-6.979,12.769-7.014c5.24-0.052,10.004,2.538,12.862,6.841l22.964,34.573h72.584 c1.91-6.017,3.46-11.925,4.632-17.655c1.927-9.445,2.904-18.616,2.904-27.255c0-66.108-52.944-119.89-118.022-119.89 c-31.375,0-60.943,12.398-83.251,34.909c-2.877,2.903-6.793,4.536-10.88,4.536s-8.003-1.633-10.88-4.536 c-22.309-22.511-51.876-34.909-83.251-34.909c-65.079,0-118.024,53.782-118.024,119.89c0,8.636,0.977,17.808,2.906,27.264 c4.889,23.909,15.78,49.343,32.398,75.686h52.126l33.184-51.068C159.17,231.937,164.012,229.328,169.177,229.328z"/>
  </g>
</svg>`;

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

export async function deleteMRIReport(input: {
  reportId: string;
  fileReference?: string | null;
}): Promise<void> {
  const storagePath = extractMRIStoragePath(input.fileReference);

  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(MRI_IMAGES_BUCKET)
      .remove([storagePath]);

    // Ignore missing files so stale database rows can still be deleted.
    if (
      storageError &&
      !/not found/i.test(storageError.message) &&
      !/no such object/i.test(storageError.message)
    ) {
      throw storageError;
    }
  }

  const { error } = await supabase.from('mri_reports').delete().eq('id', input.reportId);

  if (error) {
    throw error;
  }
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
  return fileName
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'mri-report';
}

function getReportNumber(input: MRIReportPdfInput): string {
  const candidates = [input.fileName, input.reportId];

  for (const candidate of candidates) {
    const match = candidate.match(/(?:report\s*)?(\d+)(?!.*\d)/i);

    if (match?.[1]) {
      return String(Number(match[1]));
    }
  }

  return input.reportId.slice(0, 8);
}

function buildPdfDownloadFileName(input: MRIReportPdfInput): string {
  const patientLabel = getPatientFirstName(input.patientName) || sanitizeDownloadFileName(input.fileName).replace(/\.[^/.]+$/, '');
  const reportNumber = getReportNumber(input);

  return sanitizeDownloadFileName(`${patientLabel} mri Report ${reportNumber} analysis pulse ai`);
}

function getHomepageUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://pulseai.abdulmoiz.net';
  }

  return window.location.origin;
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

function imageToPngDataUrl(image: HTMLImageElement, backgroundColor: string | null = '#ffffff'): string {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to prepare image for the PDF export.');
  }

  if (backgroundColor) {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0);

  return canvas.toDataURL('image/png');
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

function getDiagnosisSections(details: string | null | undefined): Array<{ title: string; body: string }> {
  const parsed = parseDiagnosisDetails(details);

  if (parsed?.sections?.length) {
    return parsed.sections;
  }

  return (parsed?.summaryText ?? []).map((body, index) => ({
    title: index === 0 ? 'Summary' : `Summary ${index + 1}`,
    body,
  }));
}

async function loadBrandLogoDataUrl(): Promise<string> {
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PULSE_AI_LOGO_SVG)}`;
  const image = await loadImage(svgUrl);

  return imageToPngDataUrl(image, null);
}

function drawPdfBranding(
  doc: jsPDF,
  pageNumber: number,
  totalPages: number,
  logoDataUrl: string | null,
  homepageUrl: string,
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const headerX = PDF_MARGIN;
  const headerY = 24;
  const headerWidth = pageWidth - PDF_MARGIN * 2;
  const headerHeight = 54;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BRAND_BORDER);
  doc.setLineWidth(0.8);
  doc.roundedRect(headerX, headerY, headerWidth, headerHeight, 14, 14, 'FD');

  doc.setFillColor(...BRAND_PRIMARY);
  doc.roundedRect(headerX, headerY, 6, headerHeight, 3, 3, 'F');

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', headerX + 18, headerY + 9, 36, 36);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...BRAND_PRIMARY);
    doc.text('P', headerX + 30, headerY + headerHeight / 2 + 4.5);
  }

  doc.setTextColor(...BRAND_TEXT);
  doc.setFontSize(18);
  doc.text('Pulse AI', headerX + 62, headerY + 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_MUTED);
  doc.text('Heart Disease Detection System', headerX + 62, headerY + 38);

  doc.setTextColor(...BRAND_PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Clinical Report Export', headerX + headerWidth - 14, headerY + 21, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const homepageTextWidth = doc.getTextWidth(homepageUrl);
  const homepageTextRight = headerX + headerWidth - 14;
  doc.text(homepageUrl, homepageTextRight, headerY + 36, { align: 'right' });
  doc.link(homepageTextRight - homepageTextWidth, headerY + 27, homepageTextWidth, 12, { url: homepageUrl });

  doc.setDrawColor(...BRAND_BORDER);
  doc.line(PDF_MARGIN, pageHeight - 30, pageWidth - PDF_MARGIN, pageHeight - 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_MUTED);
  const footerText = 'Generated by Pulse AI';
  const footerTextWidth = doc.getTextWidth(footerText);
  doc.text(footerText, PDF_MARGIN, pageHeight - 16);
  doc.link(PDF_MARGIN, pageHeight - 25, footerTextWidth, 12, { url: homepageUrl });
  doc.text('Confidential medical report', pageWidth / 2, pageHeight - 16, { align: 'center' });
  doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - PDF_MARGIN, pageHeight - 16, { align: 'right' });
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND_TEXT);
  doc.text(title, PDF_MARGIN, y);

  doc.setDrawColor(...BRAND_PRIMARY);
  doc.setLineWidth(2);
  doc.line(PDF_MARGIN, y + 7, PDF_MARGIN + 32, y + 7);

  return y + 24;
}

function drawRoundedPanel(doc: jsPDF, x: number, y: number, width: number, height: number): void {
  doc.setFillColor(...BRAND_SURFACE);
  doc.setDrawColor(...BRAND_BORDER);
  doc.setLineWidth(0.8);
  doc.roundedRect(x, y, width, height, 10, 10, 'FD');
}

function drawBadge(doc: jsPDF, label: string, x: number, y: number, tone: 'high' | 'medium' | 'low' | 'neutral'): void {
  const colors = {
    high: { fill: [254, 226, 226] as const, text: [185, 28, 28] as const },
    medium: { fill: [254, 249, 195] as const, text: [161, 98, 7] as const },
    low: { fill: [220, 252, 231] as const, text: [22, 101, 52] as const },
    neutral: { fill: [243, 244, 246] as const, text: BRAND_TEXT },
  }[tone];
  const width = doc.getTextWidth(label) + 18;

  doc.setFillColor(...colors.fill);
  doc.roundedRect(x, y - 12, width, 20, 10, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...colors.text);
  doc.text(label, x + 9, y + 2);
}

function drawKeyValue(doc: jsPDF, label: string, value: string, x: number, y: number, width: number): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_MUTED);
  doc.text(label.toUpperCase(), x, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_TEXT);
  const wrappedValue = doc.splitTextToSize(value || 'N/A', width);
  doc.text(wrappedValue, x, y + 14);

  return y + 14 + wrappedValue.length * 12;
}

function drawKeyValueCard(doc: jsPDF, label: string, value: string, x: number, y: number, width: number): number {
  const wrappedValue = doc.splitTextToSize(value || 'N/A', width - 28);
  const height = Math.max(52, wrappedValue.length * 12 + 30);

  drawRoundedPanel(doc, x, y, width, height);
  drawKeyValue(doc, label, value, x + 14, y + 18, width - 28);

  return height;
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

  const dataUrl = await blobToDataUrl(blob);
  const image = await loadImage(dataUrl);
  const isPng = blob.type.includes('png');
  const isJpeg = blob.type.includes('jpeg') || blob.type.includes('jpg');

  return {
    dataUrl: isPng || isJpeg ? dataUrl : imageToPngDataUrl(image),
    format: isPng ? 'PNG' : isJpeg ? 'JPEG' : 'PNG',
    width: image.width,
    height: image.height,
  };
}

export async function downloadMRIReportPdf(input: MRIReportPdfInput): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  let currentY = PDF_CONTENT_TOP;
  const generatedAt = new Date().toLocaleString();
  const riskLevel = input.riskLevel?.toLowerCase();
  const brandLogoDataUrl = await loadBrandLogoDataUrl().catch(() => null);
  const parsedDetails = parseDiagnosisDetails(input.details);
  const homepageUrl = getHomepageUrl();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...BRAND_TEXT);
  doc.text('MRI Report Summary', PDF_MARGIN, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_MUTED);
  doc.text(`Generated on ${generatedAt}`, PDF_MARGIN, currentY + 17);

  if (input.riskLevel) {
    drawBadge(
      doc,
      `${input.riskLevel.toUpperCase()} RISK`,
      pageWidth - PDF_MARGIN - 100,
      currentY + 8,
      riskLevel === 'high' || riskLevel === 'medium' || riskLevel === 'low' ? riskLevel : 'neutral',
    );
  }

  currentY += 44;

  doc.setDrawColor(...BRAND_BORDER);
  doc.line(PDF_MARGIN, currentY - 6, pageWidth - PDF_MARGIN, currentY - 6);
  currentY += 20;

  const reportRows = [
    // ['Report ID', input.reportId],
    // ['File Name', input.fileName],
    //['Website', homepageUrl],
    input.createdAt ? ['Created At', new Date(input.createdAt).toLocaleString()] : null,
    input.status ? ['Status', input.status] : null,
    input.patientName ? ['Patient', input.patientName] : null,
    // input.patientId ? ['Patient ID', input.patientId] : null,
  ].filter(Boolean) as Array<[string, string]>;

  currentY = drawSectionTitle(doc, 'Report Information', currentY);
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;

  for (let index = 0; index < reportRows.length; index += 2) {
    const left = reportRows[index];
    const right = reportRows[index + 1];
    const leftHeight = drawKeyValueCard(doc, left[0], left[1], PDF_MARGIN, currentY, cardWidth);
    const rightHeight = right
      ? drawKeyValueCard(doc, right[0], right[1], PDF_MARGIN + cardWidth + cardGap, currentY, cardWidth)
      : 0;
    currentY += Math.max(leftHeight, rightHeight) + cardGap;
  }

  currentY += 12;

  const metricRows = parsedDetails?.metrics
    ?.filter((metric) => !['Risk level', 'Confidence'].includes(metric.label))
    .map((metric) => [metric.label, metric.value] as [string, string]) ?? [];
  const clinicalRows = [
    parsedDetails?.headline?.title ? ['Predicted Condition', parsedDetails.headline.title] : null,
    // parsedDetails?.headline?.label ? ['Model Label', parsedDetails.headline.label] : null,
    input.riskLevel ? ['Risk Level', input.riskLevel.toUpperCase()] : null,
    typeof input.confidence === 'number' ? ['Confidence', `${input.confidence}%`] : null,
    ...metricRows,
  ].filter(Boolean) as Array<[string, string]>;

  if (clinicalRows.length) {
    currentY = ensurePdfSpace(doc, currentY, 76);
    currentY = drawSectionTitle(doc, 'Clinical Snapshot', currentY);

    for (let index = 0; index < clinicalRows.length; index += 2) {
      const left = clinicalRows[index];
      const right = clinicalRows[index + 1];
      currentY = ensurePdfSpace(doc, currentY, 64);
      const leftHeight = drawKeyValueCard(doc, left[0], left[1], PDF_MARGIN, currentY, cardWidth);
      const rightHeight = right
        ? drawKeyValueCard(doc, right[0], right[1], PDF_MARGIN + cardWidth + cardGap, currentY, cardWidth)
        : 0;
      currentY += Math.max(leftHeight, rightHeight) + cardGap;
    }

    currentY += 12;
  }

  const pdfImage = await loadPdfImage(input.fileReference);

  if (pdfImage) {
    const maxImageWidth = contentWidth;
    const maxImageHeight = 220;
    const scale = Math.min(maxImageWidth / pdfImage.width, maxImageHeight / pdfImage.height, 1);
    const renderWidth = pdfImage.width * scale;
    const renderHeight = pdfImage.height * scale;

    currentY = ensurePdfSpace(doc, currentY + 8, renderHeight + 58);
    currentY = drawSectionTitle(doc, 'MRI Scan Image', currentY);
    drawRoundedPanel(doc, PDF_MARGIN, currentY - 8, contentWidth, renderHeight + 28);

    doc.addImage(
      pdfImage.dataUrl,
      pdfImage.format,
      PDF_MARGIN + (contentWidth - renderWidth) / 2,
      currentY + 6,
      renderWidth,
      renderHeight,
    );

    currentY += renderHeight + 34;
  }

  const detailSections = getDiagnosisSections(input.details);

  if (detailSections.length) {
    currentY = ensurePdfSpace(doc, currentY, 34);
    currentY = drawSectionTitle(doc, 'Analysis Details', currentY);

    for (const section of detailSections) {
      const wrappedTitle = doc.splitTextToSize(section.title || 'Detail', contentWidth - 28);
      const wrappedBody = doc.splitTextToSize(section.body || ' ', contentWidth - 28);
      const blockHeight = Math.max(
        54,
        wrappedTitle.length * 13 + wrappedBody.length * PDF_LINE_HEIGHT + 28,
      );
      currentY = ensurePdfSpace(doc, currentY, blockHeight);

      drawRoundedPanel(doc, PDF_MARGIN, currentY - 8, contentWidth, blockHeight);
      let paragraphY = currentY + 10;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...BRAND_TEXT);

      for (const line of wrappedTitle) {
        doc.text(line, PDF_MARGIN + 14, paragraphY);
        paragraphY += 13;
      }

      paragraphY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      for (const line of wrappedBody) {
        doc.setTextColor(...BRAND_TEXT);
        doc.text(line, PDF_MARGIN + 14, paragraphY);
        paragraphY += PDF_LINE_HEIGHT;
      }

      currentY += blockHeight + 8;
    }
  }

  const totalPages = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    drawPdfBranding(doc, pageNumber, totalPages, brandLogoDataUrl, homepageUrl);
  }

  doc.save(`${buildPdfDownloadFileName(input)}.pdf`);
}
