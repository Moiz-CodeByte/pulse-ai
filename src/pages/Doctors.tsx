import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Briefcase, CalendarDays, Loader2, Mail, MapPin, Search, Star, Stethoscope } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DoctorDetailsPanel } from '@/components/patient/DoctorDetailsPanel';
import {
  fetchAvailableDoctors,
  formatConsultationFee,
  formatRating,
  type DoctorDirectoryProfile,
} from '@/lib/doctorProfiles';

function RatingStars({ rating }: { rating?: number }) {
  const roundedRating = Math.round(rating ?? 0);

  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={
            star <= roundedRating
              ? 'h-4 w-4 fill-primary text-primary'
              : 'h-4 w-4 text-muted-foreground/40'
          }
        />
      ))}
    </div>
  );
}

function getDoctorSummary(doctor: DoctorDirectoryProfile) {
  const summaryParts = [
    doctor.specializations.join(', '),
    doctor.yearsOfExperience ? `${doctor.yearsOfExperience} years experience` : '',
    doctor.hospitalAffiliations[0],
  ].filter(Boolean);

  return summaryParts.join(' • ') || 'Verified Pulse AI doctor';
}

export default function Doctors() {
  const [doctors, setDoctors] = useState<DoctorDirectoryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedDoctorId, setExpandedDoctorId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDoctors() {
      setLoading(true);
      setError(null);

      try {
        const doctorList = await fetchAvailableDoctors();
        if (!cancelled) {
          setDoctors(doctorList);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Doctors could not be loaded right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDoctors();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredDoctors = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return doctors;
    }

    return doctors.filter((doctor) => {
      const searchableText = [
        doctor.fullName,
        doctor.email,
        doctor.bio,
        doctor.specializations.join(' '),
        doctor.hospitalAffiliations.join(' '),
        doctor.officeAddress,
        doctor.certifications.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [doctors, search]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24">
        <section className="border-b bg-muted/30 py-10 sm:py-14">
          <div className="container mx-auto px-4">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  Verified Cardiologists
                </div>
                <h1 className="text-3xl font-display font-bold text-foreground sm:text-4xl">
                  Find Pulse AI Doctors
                </h1>
                <p className="mt-3 text-base leading-7 text-muted-foreground sm:text-lg">
                  Browse registered and verified doctors, review their specialties, experience,
                  availability, consultation fee, and patient ratings before sending an MRI report.
                </p>
              </div>

              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-medium">Search doctors</p>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Name, specialty, hospital..."
                      className="pl-9"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-8 sm:py-10">
          <div className="container mx-auto px-4">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-destructive">
                {error}
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center">
                <Stethoscope className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-lg font-medium">No doctors found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different search term or check back later.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredDoctors.length} verified doctor{filteredDoctors.length === 1 ? '' : 's'}
                  </p>
                  <Link to="/auth?mode=register">
                    <Button className="w-full sm:w-auto">Create Patient Account</Button>
                  </Link>
                </div>

                <div className="grid gap-4">
                  {filteredDoctors.map((doctor) => {
                    const expanded = expandedDoctorId === doctor.id;

                    return (
                      <Card key={doctor.id} className="overflow-hidden">
                        <CardContent className="p-4 sm:p-5">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                  <Stethoscope className="h-6 w-6 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <h2 className="text-xl font-semibold text-foreground">{doctor.fullName}</h2>
                                  <p className="mt-1 text-sm text-muted-foreground">{getDoctorSummary(doctor)}</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {doctor.specializations.slice(0, 4).map((specialization) => (
                                      <Badge key={specialization} variant="secondary">
                                        {specialization}
                                      </Badge>
                                    ))}
                                    {doctor.specializations.length > 4 && (
                                      <Badge variant="outline">+{doctor.specializations.length - 4} more</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {doctor.bio && (
                                <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">
                                  {doctor.bio}
                                </p>
                              )}
                            </div>

                            <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2 lg:w-96 lg:grid-cols-1 xl:grid-cols-2">
                              <div>
                                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <Star className="h-3.5 w-3.5" />
                                  Patient Rating
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <RatingStars rating={doctor.averageRating} />
                                  <span className="font-medium">{formatRating(doctor.averageRating, doctor.totalReviews)}</span>
                                </div>
                              </div>
                              <div>
                                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <Award className="h-3.5 w-3.5" />
                                  Fee
                                </p>
                                <p className="mt-1 font-medium">{formatConsultationFee(doctor.consultationFee)}</p>
                              </div>
                              <div>
                                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <Briefcase className="h-3.5 w-3.5" />
                                  Experience
                                </p>
                                <p className="mt-1 font-medium">
                                  {doctor.yearsOfExperience ? `${doctor.yearsOfExperience} years` : 'Not provided'}
                                </p>
                              </div>
                              <div>
                                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  Availability
                                </p>
                                <p className="mt-1 font-medium">
                                  {doctor.availabilitySchedule.length
                                    ? `${doctor.availabilitySchedule.length} schedule item${doctor.availabilitySchedule.length === 1 ? '' : 's'}`
                                    : 'Not provided'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                            <p className="flex min-w-0 items-center gap-2">
                              <Mail className="h-4 w-4 shrink-0 text-primary" />
                              <span className="truncate">{doctor.email}</span>
                            </p>
                            <p className="flex min-w-0 items-center gap-2">
                              <MapPin className="h-4 w-4 shrink-0 text-primary" />
                              <span className="truncate">{doctor.officeAddress || 'Office address not provided'}</span>
                            </p>
                          </div>

                          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full sm:w-auto"
                              onClick={() => setExpandedDoctorId(expanded ? null : doctor.id)}
                            >
                              {expanded ? 'Hide Information' : 'View Information'}
                            </Button>
                            <Link to="/auth?mode=register" className="w-full sm:w-auto">
                              <Button className="w-full">Send Report</Button>
                            </Link>
                          </div>

                          {expanded && (
                            <div className="mt-4">
                              <DoctorDetailsPanel doctor={doctor} />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
