export interface PrescriptionDisplayInput {
  medicine?: string | null;
  dosage?: string | null;
  instructions?: string | null;
}

export interface PrescriptionMedicineLine {
  name: string;
  dose?: string;
  frequency?: string;
  duration?: string;
}

function splitList(value?: string | null): string[] {
  return (value ?? '')
    .split(/\s*;\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitMedicines(value?: string | null): Array<{ name: string; dose?: string }> {
  return (value ?? '')
    .split(/\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.*?)\s*\(([^)]*)\)\s*$/);

      if (!match) {
        return { name: item };
      }

      return {
        name: match[1].trim(),
        dose: match[2].trim(),
      };
    });
}

export function getPrescriptionMedicineLines(
  prescription: PrescriptionDisplayInput,
): PrescriptionMedicineLine[] {
  const medicines = splitMedicines(prescription.medicine);
  const frequencies = splitList(prescription.dosage);
  const durations = splitList((prescription.instructions ?? '').split('|')[0]);

  if (!medicines.length) {
    return [];
  }

  return medicines.map((medicine, index) => ({
    name: medicine.name,
    dose: medicine.dose,
    frequency: frequencies[index],
    duration: durations[index],
  }));
}
