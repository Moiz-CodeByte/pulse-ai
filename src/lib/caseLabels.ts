interface SequencedItem {
  id: string;
  created_at?: string | null;
  createdAt?: string | null;
}

export function getPatientFirstName(name?: string | null, email?: string | null): string {
  const cleanName = name?.trim();

  if (cleanName) {
    return cleanName.split(/\s+/)[0] || 'Patient';
  }

  const emailName = email?.split('@')[0]?.trim();
  return emailName || 'Patient';
}

export function buildSequenceMap<T extends SequencedItem>(items: T[]): Map<string, number> {
  return new Map(
    [...items]
      .sort((a, b) => {
        const aTime = new Date(a.created_at ?? a.createdAt ?? 0).getTime();
        const bTime = new Date(b.created_at ?? b.createdAt ?? 0).getTime();
        return aTime - bTime;
      })
      .map((item, index) => [item.id, index + 1]),
  );
}

export function formatReportLabel(input: {
  patientName?: string | null;
  patientEmail?: string | null;
  reportNumber?: number | null;
}): string {
  const firstName = getPatientFirstName(input.patientName, input.patientEmail);
  return `${firstName} Report ${input.reportNumber ?? 1}`;
}

export function formatCaseLabel(input: {
  reportLabel: string;
  caseNumber?: number | null;
}): string {
  return `${input.reportLabel} - Case ${input.caseNumber ?? 1}`;
}
