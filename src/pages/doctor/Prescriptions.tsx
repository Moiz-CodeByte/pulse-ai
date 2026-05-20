import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, ChevronDown, ChevronUp, ClipboardList, FileText, Hash, Pill, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getPrescriptionMedicineLines } from '@/lib/prescriptions';
import { buildSequenceMap, formatCaseLabel, formatReportLabel } from '@/lib/caseLabels';

interface Prescription {
  id: string;
  medicine: string;
  dosage: string;
  instructions: string;
  notes: string;
  created_at: string;
  diagnosis_id: string;
  caseId?: string;
  report?: {
    id: string;
    fileName: string;
    label: string;
    createdAt: string;
    status?: string | null;
    riskLevel?: string | null;
    confidence?: number | null;
  };
  patient?: {
    id: string;
    name: string;
    email?: string | null;
  };
  caseName?: string;
  caseStatus?: string | null;
  caseRequestedAt?: string | null;
}

export default function DoctorPrescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientFilter, setPatientFilter] = useState('all');
  const [patientSearch, setPatientSearch] = useState('');
  const [expandedPrescriptions, setExpandedPrescriptions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) {
      fetchPrescriptions();
    }
  }, [user]);

  const fetchPrescriptions = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('prescriptions')
      .select('id, diagnosis_id, doctor_id, medicine, dosage, instructions, notes, created_at')
      .eq('doctor_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const diagnosisIds = [...new Set(data.map((item) => item.diagnosis_id).filter(Boolean))];
      const { data: diagnoses } = diagnosisIds.length
        ? await supabase
            .from('diagnosis')
            .select('id, report_id, risk_level, confidence')
            .in('id', diagnosisIds)
        : { data: [] };

      const reportIds = [...new Set((diagnoses ?? []).map((item) => item.report_id).filter(Boolean))];
      const { data: reports } = reportIds.length
        ? await supabase
            .from('mri_reports')
            .select('id, file_name, created_at, patient_id, status')
            .in('id', reportIds)
        : { data: [] };

      const patientIds = [...new Set((reports ?? []).map((item) => item.patient_id).filter(Boolean))];
      const { data: profiles } = patientIds.length
        ? await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', patientIds)
        : { data: [] };

      // @ts-expect-error - consultation_requests table not yet in generated types
      const consultationQuery = supabase.from('consultation_requests');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: consultations } = reportIds.length
        ? await (consultationQuery as any)
            .select('id, report_id, status, created_at')
            .eq('doctor_id', user.id)
            .in('report_id', reportIds)
        : { data: [] };

      const diagnosisMap = new Map((diagnoses ?? []).map((item) => [item.id, item]));
      const reportMap = new Map((reports ?? []).map((item) => [item.id, item]));
      const profileMap = new Map((profiles ?? []).map((item) => [item.id, item]));
      const consultationMap = new Map(
        ((consultations ?? []) as Array<{
          id: string;
          report_id: string;
          status: string | null;
          created_at: string | null;
        }>).map((item) => [item.report_id, item]),
      );
      const reportSequencesByPatient = new Map<string, Map<string, number>>();
      const caseSequencesByPatient = new Map<string, Map<string, number>>();

      for (const patientId of patientIds) {
        const patientReports = (reports ?? []).filter((report) => report.patient_id === patientId);
        reportSequencesByPatient.set(patientId, buildSequenceMap(patientReports));

        const patientCaseItems = patientReports
          .map((report) => {
            const consultation = consultationMap.get(report.id);
            return consultation ? { id: consultation.id, created_at: consultation.created_at ?? report.created_at } : null;
          })
          .filter(Boolean) as Array<{ id: string; created_at: string }>;
        caseSequencesByPatient.set(patientId, buildSequenceMap(patientCaseItems));
      }

      setPrescriptions(data.map((prescription) => {
        const diagnosis = diagnosisMap.get(prescription.diagnosis_id);
        const report = diagnosis?.report_id ? reportMap.get(diagnosis.report_id) : undefined;
        const patient = report?.patient_id ? profileMap.get(report.patient_id) : undefined;
        const reportLabel = report
          ? formatReportLabel({
              patientName: patient?.full_name,
              patientEmail: patient?.email,
              reportNumber: reportSequencesByPatient.get(report.patient_id)?.get(report.id),
            })
          : 'MRI report';
        const consultation = report?.id ? consultationMap.get(report.id) : undefined;
        const caseId = consultation?.id;

        return {
          ...prescription,
          caseId,
          caseStatus: consultation?.status,
          caseRequestedAt: consultation?.created_at,
          caseName: caseId ? formatCaseLabel({
            reportLabel,
            caseNumber: report?.patient_id ? caseSequencesByPatient.get(report.patient_id)?.get(caseId) : undefined,
          }) : undefined,
          report: report
            ? {
                id: report.id,
                fileName: report.file_name,
                label: reportLabel,
                createdAt: report.created_at,
                status: report.status,
                riskLevel: diagnosis?.risk_level,
                confidence: diagnosis?.confidence,
              }
            : undefined,
          patient: patient
            ? {
                id: patient.id,
                name: patient.full_name || patient.email || 'Patient',
                email: patient.email,
              }
            : undefined,
        };
      }));
    }
    setLoading(false);
  };

  const patientFilterOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const prescription of prescriptions) {
      if (prescription.patient?.id && !map.has(prescription.patient.id)) {
        map.set(prescription.patient.id, prescription.patient.name || prescription.patient.email || 'Patient');
      }
    }

    return [...map.entries()]
      .map(([patientId, label]) => ({ patientId, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [prescriptions]);

  const filteredPrescriptions = useMemo(
    () => {
      const normalizedSearch = patientSearch.trim().toLowerCase();

      return prescriptions
        .filter((prescription) => patientFilter === 'all' || prescription.patient?.id === patientFilter)
        .filter((prescription) => {
          if (!normalizedSearch) {
            return true;
          }

          const name = prescription.patient?.name?.toLowerCase() ?? '';
          const email = prescription.patient?.email?.toLowerCase() ?? '';
          const medicines = getPrescriptionMedicineLines(prescription)
            .map((medicine) => medicine.name)
            .join(' ')
            .toLowerCase();
          return name.includes(normalizedSearch) || email.includes(normalizedSearch) || medicines.includes(normalizedSearch);
        });
    },
    [patientFilter, patientSearch, prescriptions],
  );

  return (
    <DashboardLayout 
      title="My Prescriptions" 
      subtitle="View all prescriptions you've written"
    >
      <Card>
        <CardHeader>
          <CardTitle>Prescription History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading prescriptions...</p>
          ) : prescriptions.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No prescriptions written yet</p>
              <p className="text-muted-foreground">
                Your prescription history will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-[minmax(0,1fr)_260px]">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Search</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={patientSearch}
                      onChange={(event) => setPatientSearch(event.target.value)}
                      placeholder="Search patient, email, or medicine"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Filter by patient</p>
                  <Select value={patientFilter} onValueChange={setPatientFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All patients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All patients</SelectItem>
                      {patientFilterOptions.map((patient) => (
                        <SelectItem key={patient.patientId} value={patient.patientId}>
                          {patient.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredPrescriptions.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  No prescriptions found for this patient.
                </div>
              )}

              {filteredPrescriptions.map((prescription) => {
                const medicineLines = getPrescriptionMedicineLines(prescription);
                const expanded = expandedPrescriptions[prescription.id] ?? false;

                return (
                  <div
                    key={prescription.id}
                    className="rounded-xl border bg-card p-4 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="w-fit rounded-lg bg-primary/10 p-3">
                        <Pill className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-semibold">{prescription.patient?.name || 'Patient'}</h3>
                            {prescription.patient?.email && (
                              <p className="truncate text-sm text-muted-foreground">{prescription.patient.email}</p>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            Prescribed {new Date(prescription.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm md:grid-cols-2">
                          <div className="flex min-w-0 gap-2">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">Case / Report</p>
                              <p className="font-medium truncate">{prescription.report?.label || 'MRI report'}</p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {prescription.report?.riskLevel && (
                                  <Badge variant="outline">{prescription.report.riskLevel.toUpperCase()} Risk</Badge>
                                )}
                                {prescription.caseId && (
                                  <Badge variant="secondary">{prescription.caseName || `Case #${prescription.caseId.slice(0, 8)}`}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex min-w-0 gap-2">
                            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">Clinical Context</p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {typeof prescription.report?.confidence === 'number' && (
                                  <Badge variant="outline">{prescription.report.confidence}% Confidence</Badge>
                                )}
                                {prescription.report?.status && (
                                  <Badge variant="secondary" className="capitalize">Report {prescription.report.status}</Badge>
                                )}
                                {prescription.caseStatus && (
                                  <Badge variant="secondary" className="capitalize">Case {prescription.caseStatus}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {medicineLines.length} medicine{medicineLines.length === 1 ? '' : 's'}
                          </Badge>
                          {/* {medicineLines[0] && (
                            <span className="text-sm text-muted-foreground">
                              First medicine: {medicineLines[0].name}
                            </span>
                          )} */}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => setExpandedPrescriptions((current) => ({
                            ...current,
                            [prescription.id]: !expanded,
                          }))}
                        >
                          {expanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                          {expanded ? 'Hide Details' : 'Show More'}
                        </Button>
                        {expanded && (
                          <div className="space-y-3">
                            <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                              <div className="flex min-w-0 gap-2">
                                <Hash className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Reference IDs</p>
                                  <p className="truncate font-mono text-xs">Rx {prescription.id.slice(0, 8)}</p>
                                  {prescription.report?.id && (
                                    <p className="truncate font-mono text-xs text-muted-foreground">
                                      Report {prescription.report.id.slice(0, 8)}
                                    </p>
                                  )}
                                  {prescription.caseId && (
                                    <p className="truncate font-mono text-xs text-muted-foreground">
                                      Case {prescription.caseId.slice(0, 8)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm md:grid-cols-3">
                              <div className="flex min-w-0 gap-2">
                                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Prescription Date</p>
                                  <p className="font-medium">{new Date(prescription.created_at).toLocaleString()}</p>
                                </div>
                              </div>
                              {prescription.caseRequestedAt && (
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Case Requested</p>
                                  <p className="font-medium">{new Date(prescription.caseRequestedAt).toLocaleString()}</p>
                                </div>
                              )}
                              {prescription.report?.createdAt && (
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Report Uploaded</p>
                                  <p className="font-medium">{new Date(prescription.report.createdAt).toLocaleString()}</p>
                                </div>
                              )}
                            </div>
                            <div className="space-y-3">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <p className="font-medium">Medicines</p>
                                <Badge variant="outline">
                                  {medicineLines.length} medicine{medicineLines.length === 1 ? '' : 's'}
                                </Badge>
                              </div>
                              {medicineLines.length === 0 ? (
                                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                                  No medicine details were saved for this prescription.
                                </div>
                              ) : (
                                <div className="grid gap-3 md:grid-cols-2">
                                  {medicineLines.map((medicine, index) => (
                                    <div key={`${medicine.name}-${index}`} className="rounded-lg border p-3 text-sm">
                                      <p className="font-medium">
                                        {index + 1}. {medicine.name}
                                        {medicine.dose ? <span className="text-muted-foreground"> - {medicine.dose}</span> : null}
                                      </p>
                                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                        <div>
                                          <p className="text-xs text-muted-foreground">Frequency</p>
                                          <p>{medicine.frequency || 'Not specified'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground">Duration</p>
                                          <p>{medicine.duration || 'Not specified'}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {prescription.notes && (
                                <div className="rounded-lg bg-muted p-3">
                                  <span className="text-sm font-medium">Doctor Notes</span>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{prescription.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
