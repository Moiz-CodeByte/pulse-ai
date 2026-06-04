import { Award, Briefcase, CalendarDays, MapPin, Phone, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { DoctorDirectoryProfile } from '@/lib/doctorProfiles';
import { formatConsultationFee, formatRating } from '@/lib/doctorProfiles';

interface DoctorDetailsPanelProps {
  doctor: DoctorDirectoryProfile;
}

function renderFallback(message: string) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

export function DoctorDetailsPanel({ doctor }: DoctorDetailsPanelProps) {
  const hasDetailedProfile =
    doctor.profileCompleted ||
    doctor.educationHistory.length > 0 ||
    doctor.workHistory.length > 0 ||
    doctor.availabilitySchedule.length > 0 ||
    Boolean(doctor.bio);

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{doctor.fullName}</h3>
          <p className="text-sm text-muted-foreground">{doctor.email}</p>
          {/* {doctor.bio ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{doctor.bio}</p>
          ) : null} */}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Consultation Fee
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatConsultationFee(doctor.consultationFee)}
            </p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Star className="h-3.5 w-3.5" />
              Patient Rating
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formatRating(doctor.averageRating, doctor.totalReviews)}
            </p>
          </div>
        </div>
      </div>

      {!hasDetailedProfile && (
        <Alert>
          <AlertDescription>
            This doctor has not completed their professional profile yet. Basic information is
            shown where available.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground">Specializations</h4>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {doctor.specializations.length
              ? doctor.specializations.map((specialization) => (
                  <Badge key={specialization} variant="secondary">
                    {specialization}
                  </Badge>
                ))
              : renderFallback('No specialization information provided.')}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Experience
              </p>
              <p className="mt-1 text-sm text-foreground">
                {doctor.yearsOfExperience
                  ? `${doctor.yearsOfExperience} years`
                  : 'Not provided'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                License Number
              </p>
              <p className="mt-1 break-all text-sm text-foreground">
                {doctor.medicalLicenseNumber || 'Not provided'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground">Contact</h4>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Phone
              </p>
              <p className="mt-1 text-sm text-foreground">{doctor.phoneNumber || 'Not provided'}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                Office Address
              </div>
              <p className="mt-1 text-sm text-foreground">
                {doctor.officeAddress || 'Not provided'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground">Education Background</h4>
          </div>
          <div className="mt-3 space-y-3">
            {doctor.educationHistory.length ? (
              doctor.educationHistory.map((entry, index) => (
                <div key={`${entry.degree}-${index}`} className="rounded-md border p-3">
                  <p className="font-medium text-foreground">{entry.degree || 'Degree not specified'}</p>
                  <p className="text-sm text-muted-foreground">
                    {entry.school || 'School not provided'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Graduation Year: {entry.graduationYear || 'Not provided'}
                  </p>
                </div>
              ))
            ) : (
              renderFallback('No education background provided.')
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground">Medical Experience</h4>
          </div>
          <div className="mt-3 space-y-3">
            {doctor.workHistory.length ? (
              doctor.workHistory.map((entry, index) => (
                <div key={`${entry.hospital}-${index}`} className="rounded-md border p-3">
                  <p className="font-medium text-foreground">
                    {entry.position || 'Position not provided'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[entry.hospital, entry.department].filter(Boolean).join(' • ') || 'Hospital affiliation not provided'}
                  </p>
                </div>
              ))
            ) : (
              renderFallback('No medical experience information provided.')
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground">Certifications</h4>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {doctor.certifications.length
              ? doctor.certifications.map((certification) => (
                  <Badge key={certification} variant="outline">
                    {certification}
                  </Badge>
                ))
              : renderFallback('No certifications provided.')}
          </div>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground">Hospital Affiliations</h4>
          </div>
          <div className="mt-3 space-y-2">
            {doctor.hospitalAffiliations.length ? (
              doctor.hospitalAffiliations.map((hospital) => (
                <p key={hospital} className="text-sm text-foreground">
                  {hospital}
                </p>
              ))
            ) : (
              renderFallback('No hospital affiliations provided.')
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-foreground">Availability Schedule</h4>
        </div>
        <div className="mt-3 space-y-2">
          {doctor.availabilitySchedule.length ? (
            doctor.availabilitySchedule.map((entry, index) => (
              <div
                key={`${entry.day}-${entry.startTime}-${index}`}
                className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-foreground">{entry.day || 'Day not set'}</span>
                <span className="text-sm text-muted-foreground">
                  {entry.startTime && entry.endTime
                    ? `${entry.startTime} - ${entry.endTime}`
                    : 'Time not provided'}
                </span>
                <span className="text-sm text-muted-foreground">{entry.notes || 'No notes'}</span>
              </div>
            ))
          ) : (
            renderFallback('No availability schedule provided.')
          )}
        </div>
      </div>
    </div>
  );
}
