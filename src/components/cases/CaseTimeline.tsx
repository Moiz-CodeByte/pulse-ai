import { Download, Eye, FileText, MessageSquare, Pill } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPrescriptionMedicineLines } from '@/lib/prescriptions';

export interface CaseTimelinePrescription {
  id: string;
  medicine: string | null;
  dosage: string | null;
  instructions: string | null;
  notes: string | null;
}

export interface CaseTimelineItem {
  id: string;
  reportId: string;
  reportName: string;
  caseName?: string;
  requestedAt: string;
  status?: string | null;
  riskLevel?: string | null;
  patientMessage?: string | null;
  doctorNotes?: string | null;
  prescriptions?: CaseTimelinePrescription[];
}

export function CaseTimeline({
  items,
  onViewReport,
  onDownloadReport,
}: {
  items: CaseTimelineItem[];
  onViewReport?: (item: CaseTimelineItem) => void;
  onDownloadReport?: (item: CaseTimelineItem) => void;
}) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No case history yet.</p>;
  }

  return (
    <div className="min-w-0 space-y-4">
      {items.map((item, index) => (
        <div key={item.id} className="relative min-w-0 pl-4 sm:pl-6">
          <div className="absolute left-1 top-1.5 h-3 w-3 rounded-full bg-primary" />
          {index < items.length - 1 && (
            <div className="absolute left-[9px] top-5 h-[calc(100%+0.75rem)] w-px bg-border" />
          )}
          <div className="min-w-0 space-y-3 overflow-hidden rounded-lg border bg-card p-2.5 sm:p-3">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="flex min-w-0 items-start gap-2 text-sm font-medium">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 break-words">{item.reportName}</span>
                </p>
                {item.caseName && (
                  <p className="mt-1 break-words text-xs font-medium text-muted-foreground">
                    {item.caseName}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(item.requestedAt).toLocaleString()}
                </p>
              </div>
              {item.riskLevel ? (
                <Badge variant="outline" className="w-fit max-w-full shrink-0 break-words text-left">
                  {item.riskLevel.toUpperCase()} Risk
                </Badge>
              ) : item.status ? (
                <Badge variant="secondary" className="w-fit max-w-full shrink-0 capitalize">
                  {item.status}
                </Badge>
              ) : null}
            </div>

            {(onViewReport || onDownloadReport) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {onViewReport && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-9 w-full min-w-0 whitespace-normal"
                    onClick={() => onViewReport(item)}
                  >
                    <Eye className="mr-2 h-4 w-4 shrink-0" />
                    <span className="min-w-0">Review</span>
                  </Button>
                )}
                {onDownloadReport && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-9 w-full min-w-0 whitespace-normal"
                    onClick={() => onDownloadReport(item)}
                  >
                    <Download className="mr-2 h-4 w-4 shrink-0" />
                    <span className="min-w-0">PDF</span>
                  </Button>
                )}
              </div>
            )}

            {item.patientMessage && (
              <div className="min-w-0 rounded-md bg-muted/50 p-2 text-sm">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Patient request
                </p>
                <p className="break-words">{item.patientMessage}</p>
              </div>
            )}

            {item.doctorNotes && (
              <div className="min-w-0 rounded-md bg-muted/50 p-2 text-sm">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Doctor response</p>
                <p className="break-words">{item.doctorNotes}</p>
              </div>
            )}

            {item.prescriptions?.length ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Pill className="h-3.5 w-3.5" />
                  Prescription
                </p>
                {item.prescriptions.map((prescription) => (
                  <div key={prescription.id} className="min-w-0 space-y-2 rounded-md border p-2 text-sm">
                    {getPrescriptionMedicineLines(prescription).map((medicine, medicineIndex) => (
                      <div key={`${medicine.name}-${medicineIndex}`} className="min-w-0">
                        <p className="break-words font-medium">
                          {medicineIndex + 1}. {medicine.name}
                          {medicine.dose ? <span className="text-muted-foreground"> - {medicine.dose}</span> : null}
                        </p>
                        {medicine.frequency && (
                          <p className="break-words text-muted-foreground">Frequency: {medicine.frequency}</p>
                        )}
                        {medicine.duration && (
                          <p className="break-words text-muted-foreground">Duration: {medicine.duration}</p>
                        )}
                      </div>
                    ))}
                    {prescription.notes && <p className="break-words text-muted-foreground">{prescription.notes}</p>}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
