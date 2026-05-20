import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, FileText, Pill, Search, User } from 'lucide-react';
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
    riskLevel?: string | null;
  };
  patient?: {
    id: string;
    name: string;
    email?: string | null;
  };
  caseName?: string;
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
            .select('id, report_id, risk_level')
            .in('id', diagnosisIds)
        : { data: [] };

      const reportIds = [...new Set((diagnoses ?? []).map((item) => item.report_id).filter(Boolean))];
      const { data: reports } = reportIds.length
        ? await supabase
            .from('mri_reports')
            .select('id, file_name, created_at, patient_id')
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
            .select('id, report_id')
            .eq('doctor_id', user.id)
            .in('report_id', reportIds)
        : { data: [] };

      const diagnosisMap = new Map((diagnoses ?? []).map((item) => [item.id, item]));
      const reportMap = new Map((reports ?? []).map((item) => [item.id, item]));
      const profileMap = new Map((profiles ?? []).map((item) => [item.id, item]));
      const consultationMap = new Map(
        ((consultations ?? []) as Array<{ id: string; report_id: string }>).map((item) => [item.report_id, item.id]),
      );
      const reportSequencesByPatient = new Map<string, Map<string, number>>();
      const caseSequencesByPatient = new Map<string, Map<string, number>>();

      for (const patientId of patientIds) {
        const patientReports = (reports ?? []).filter((report) => report.patient_id === patientId);
        reportSequencesByPatient.set(patientId, buildSequenceMap(patientReports));

        const patientCaseItems = patientReports
          .map((report) => {
            const caseId = consultationMap.get(report.id);
            return caseId ? { id: caseId, created_at: report.created_at } : null;
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
        const caseId = report?.id ? consultationMap.get(report.id) : undefined;

        return {
          ...prescription,
          caseId,
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
                riskLevel: diagnosis?.risk_level,
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
          return name.includes(normalizedSearch) || email.includes(normalizedSearch);
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
                  <p className="text-sm font-medium">Search patient</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={patientSearch}
                      onChange={(event) => setPatientSearch(event.target.value)}
                      placeholder="Search by name or email"
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
                const firstMedicine = medicineLines[0];
                const hasMoreDetails = medicineLines.length > 1 || Boolean(prescription.notes);

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
                          <h3 className="text-lg font-semibold">Prescription</h3>
                          <span className="text-sm text-muted-foreground">
                            {new Date(prescription.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                          <div className="flex min-w-0 gap-2">
                            <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">Patient</p>
                              <p className="font-medium truncate">{prescription.patient?.name || 'Patient'}</p>
                              {prescription.patient?.email && (
                                <p className="truncate text-xs text-muted-foreground">{prescription.patient.email}</p>
                              )}
                            </div>
                          </div>
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
                        </div>
                        {firstMedicine && (
                          <div className="rounded-lg border p-3 text-sm">
                            <p className="font-medium">
                              1. {firstMedicine.name}
                              {firstMedicine.dose ? <span className="text-muted-foreground"> - {firstMedicine.dose}</span> : null}
                            </p>
                            {firstMedicine.frequency && (
                              <p className="mt-1 text-muted-foreground">Frequency: {firstMedicine.frequency}</p>
                            )}
                            {firstMedicine.duration && (
                              <p className="text-muted-foreground">Duration: {firstMedicine.duration}</p>
                            )}
                          </div>
                        )}
                        {expanded && (
                          <div className="space-y-3">
                            {medicineLines.slice(1).map((medicine, index) => (
                              <div key={`${medicine.name}-${index + 1}`} className="rounded-lg border p-3 text-sm">
                                <p className="font-medium">
                                  {index + 2}. {medicine.name}
                                  {medicine.dose ? <span className="text-muted-foreground"> - {medicine.dose}</span> : null}
                                </p>
                                {medicine.frequency && (
                                  <p className="mt-1 text-muted-foreground">Frequency: {medicine.frequency}</p>
                                )}
                                {medicine.duration && (
                                  <p className="text-muted-foreground">Duration: {medicine.duration}</p>
                                )}
                              </div>
                            ))}
                            {prescription.notes && (
                              <div className="p-3 rounded-lg bg-muted">
                                <span className="text-sm font-medium">Notes:</span>
                                <p className="mt-1 text-sm text-muted-foreground">{prescription.notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                        {hasMoreDetails && (
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
