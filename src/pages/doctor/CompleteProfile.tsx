import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { GraduationCap, Briefcase, Phone, Award, Loader2, Info, Plus, Trash2, LogOut, CalendarDays } from 'lucide-react';

interface EducationEntry {
  degree: string;
  school: string;
  graduationYear: string;
  certifications: string;
}

interface WorkEntry {
  hospital: string;
  department: string;
  position: string;
}

interface AvailabilityEntry {
  day: string;
  startTime: string;
  endTime: string;
  notes: string;
}

export default function DoctorCompleteProfile() {
  const { user, isVerified, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [formData, setFormData] = useState({
    medical_license_number: '',
    specialization: '',
    years_of_experience: '',
    consultation_fee: '',
    phone_number: '',
    office_address: '',
    bio: '',
  });
  const [educationHistory, setEducationHistory] = useState<EducationEntry[]>([
    { degree: '', school: '', graduationYear: '', certifications: '' }
  ]);
  const [workHistory, setWorkHistory] = useState<WorkEntry[]>([
    { hospital: '', department: '', position: '' }
  ]);
  const [availabilitySchedule, setAvailabilitySchedule] = useState<AvailabilityEntry[]>([
    { day: '', startTime: '', endTime: '', notes: '' }
  ]);

  useEffect(() => {
    checkExistingProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const addEducationEntry = () => {
    setEducationHistory([...educationHistory, { degree: '', school: '', graduationYear: '', certifications: '' }]);
  };

  const removeEducationEntry = (index: number) => {
    if (educationHistory.length > 1) {
      setEducationHistory(educationHistory.filter((_, i) => i !== index));
    }
  };

  const updateEducationEntry = (index: number, field: keyof EducationEntry, value: string) => {
    const updated = [...educationHistory];
    updated[index] = { ...updated[index], [field]: value };
    setEducationHistory(updated);
  };

  const addWorkEntry = () => {
    setWorkHistory([...workHistory, { hospital: '', department: '', position: '' }]);
  };

  const removeWorkEntry = (index: number) => {
    if (workHistory.length > 1) {
      setWorkHistory(workHistory.filter((_, i) => i !== index));
    }
  };

  const updateWorkEntry = (index: number, field: keyof WorkEntry, value: string) => {
    const updated = [...workHistory];
    updated[index] = { ...updated[index], [field]: value };
    setWorkHistory(updated);
  };

  const addAvailabilityEntry = () => {
    setAvailabilitySchedule([
      ...availabilitySchedule,
      { day: '', startTime: '', endTime: '', notes: '' },
    ]);
  };

  const removeAvailabilityEntry = (index: number) => {
    if (availabilitySchedule.length > 1) {
      setAvailabilitySchedule(availabilitySchedule.filter((_, i) => i !== index));
    }
  };

  const updateAvailabilityEntry = (
    index: number,
    field: keyof AvailabilityEntry,
    value: string,
  ) => {
    const updated = [...availabilitySchedule];
    updated[index] = { ...updated[index], [field]: value };
    setAvailabilitySchedule(updated);
  };

  const checkExistingProfile = async () => {
    if (!user) return;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - doctor_information table not yet in generated types
    const { data, error } = await supabase.from('doctor_information').select('*').eq('user_id', user.id).maybeSingle();

    if (error) {
      console.error('Error checking profile:', error);
    } else if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // Load existing data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doctorData = data as any;
      setProfileCompleted(Boolean(doctorData.profile_completed));
      setFormData({
        medical_license_number: doctorData.medical_license_number || '',
        specialization: doctorData.specialization || '',
        years_of_experience: doctorData.years_of_experience?.toString() || '',
        consultation_fee: doctorData.consultation_fee?.toString() || '',
        phone_number: doctorData.phone_number || '',
        office_address: doctorData.office_address || '',
        bio: doctorData.bio || '',
      });

      // Load education history (new format) or migrate from old format
      if (doctorData.education_history && Array.isArray(doctorData.education_history) && doctorData.education_history.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setEducationHistory(doctorData.education_history.map((edu: any) => ({
          degree: edu.degree || '',
          school: edu.school || '',
          graduationYear: edu.graduationYear?.toString() || '',
          certifications: edu.certifications || ''
        })));
      } else if (doctorData.medical_degree || doctorData.medical_school) {
        // Migrate old format
        setEducationHistory([{
          degree: doctorData.medical_degree || '',
          school: doctorData.medical_school || '',
          graduationYear: doctorData.graduation_year?.toString() || '',
          certifications: doctorData.additional_certifications || ''
        }]);
      }

      // Load work history (new format) or migrate from old format
      if (doctorData.work_history && Array.isArray(doctorData.work_history) && doctorData.work_history.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setWorkHistory(doctorData.work_history.map((work: any) => ({
          hospital: work.hospital || '',
          department: work.department || '',
          position: work.position || ''
        })));
      } else if (doctorData.current_hospital || doctorData.department || doctorData.position) {
        // Migrate old format
        setWorkHistory([{
          hospital: doctorData.current_hospital || '',
          department: doctorData.department || '',
          position: doctorData.position || ''
        }]);
      }

      if (
        doctorData.availability_schedule &&
        Array.isArray(doctorData.availability_schedule) &&
        doctorData.availability_schedule.length > 0
      ) {
        setAvailabilitySchedule(
          doctorData.availability_schedule.map((slot: AvailabilityEntry) => ({
            day: slot.day || '',
            startTime: slot.startTime || '',
            endTime: slot.endTime || '',
            notes: slot.notes || '',
          })),
        );
      }
    }
    setCheckingProfile(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const hasValidEducation = educationHistory.some(edu => edu.degree.trim() !== '');
    
    if (!formData.medical_license_number || !formData.specialization || !hasValidEducation) {
      toast({
        title: 'Required fields missing',
        description: 'Please fill in medical license number, specialization, and at least one medical degree.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Filter out empty entries and convert graduation years to numbers
      const filteredEducation = educationHistory
        .filter(edu => edu.degree.trim() !== '' || edu.school.trim() !== '')
        .map(edu => ({
          degree: edu.degree,
          school: edu.school,
          graduationYear: edu.graduationYear ? parseInt(edu.graduationYear) : null,
          certifications: edu.certifications
        }));

      const filteredWork = workHistory
        .filter(work => work.hospital.trim() !== '' || work.department.trim() !== '' || work.position.trim() !== '')
        .map(work => ({
          hospital: work.hospital,
          department: work.department,
          position: work.position
        }));

      const filteredAvailability = availabilitySchedule
        .filter((slot) => slot.day.trim() !== '' || slot.startTime.trim() !== '' || slot.endTime.trim() !== '' || slot.notes.trim() !== '')
        .map((slot) => ({
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          notes: slot.notes,
        }));

      const profileData = {
        user_id: user?.id,
        medical_license_number: formData.medical_license_number,
        specialization: formData.specialization,
        years_of_experience: formData.years_of_experience ? parseInt(formData.years_of_experience) : null,
        consultation_fee: formData.consultation_fee ? parseFloat(formData.consultation_fee) : null,
        education_history: filteredEducation,
        work_history: filteredWork,
        availability_schedule: filteredAvailability,
        phone_number: formData.phone_number || null,
        office_address: formData.office_address || null,
        bio: formData.bio || null,
        profile_completed: true,
      };

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - doctor_information table not yet in generated types
      const { error } = await supabase.from('doctor_information').upsert(profileData, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: profileCompleted ? 'Profile updated!' : 'Profile completed!',
        description: isVerified 
          ? 'Your professional information has been saved successfully.'
          : 'Your profile is complete. Please wait for admin verification to access all features.',
      });

      navigate(isVerified ? '/doctor' : '/doctor/admin-chat');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save profile information.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (checkingProfile) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-20 pb-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {profileCompleted ? 'My Professional Profile' : 'Complete Your Professional Profile'}
            </h1>
            <p className="text-muted-foreground">
              {profileCompleted
                ? 'Review and update your professional information'
                : 'Please provide your professional information to complete your doctor profile'}
            </p>
          {!isVerified && (
            <Alert className="mb-6">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Profile completion is required first.</strong> After completing your profile, 
                your account will need admin verification before you can access patient cases and other features.
              </AlertDescription>
            </Alert>
          )}

        </div>

        <form onSubmit={handleSubmit}>
          {/* Professional Information */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <CardTitle>Professional Information</CardTitle>
              </div>
              <CardDescription>Your medical credentials and specialization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="license">Medical License Number *</Label>
                  <Input
                    id="license"
                    value={formData.medical_license_number}
                    onChange={(e) => setFormData({ ...formData, medical_license_number: e.target.value })}
                    placeholder="e.g., MD123456"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialization">Specialization *</Label>
                  <Input
                    id="specialization"
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    placeholder="e.g., Cardiology"
                    required
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="experience">Years of Experience</Label>
                  <Input
                    id="experience"
                    type="number"
                    min="0"
                    value={formData.years_of_experience}
                    onChange={(e) => setFormData({ ...formData, years_of_experience: e.target.value })}
                    placeholder="e.g., 10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="consultationFee">Consultation Fee</Label>
                  <Input
                    id="consultationFee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.consultation_fee}
                    onChange={(e) => setFormData({ ...formData, consultation_fee: e.target.value })}
                    placeholder="e.g., 150"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Education */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <CardTitle>Education</CardTitle>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addEducationEntry}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Education
                </Button>
              </div>
              <CardDescription>Add your educational background (at least one degree required)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {educationHistory.map((education, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-4 relative">
                  {educationHistory.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => removeEducationEntry(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor={`degree-${index}`}>Degree {index === 0 && '*'}</Label>
                    <Input
                      id={`degree-${index}`}
                      value={education.degree}
                      onChange={(e) => updateEducationEntry(index, 'degree', e.target.value)}
                      placeholder="e.g., MBBS, BS, PhD"
                      required={index === 0}
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`school-${index}`}>School/ College/ University</Label>
                      <Input
                        id={`school-${index}`}
                        value={education.school}
                        onChange={(e) => updateEducationEntry(index, 'school', e.target.value)}
                        placeholder="e.g., Harvard Medical School"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`gradYear-${index}`}>Graduation Year</Label>
                      <Input
                        id={`gradYear-${index}`}
                        type="number"
                        min="1950"
                        max={new Date().getFullYear()}
                        value={education.graduationYear}
                        onChange={(e) => updateEducationEntry(index, 'graduationYear', e.target.value)}
                        placeholder="e.g., 2015"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`certifications-${index}`}>Additional Certifications</Label>
                    <Textarea
                      id={`certifications-${index}`}
                      value={education.certifications}
                      onChange={(e) => updateEducationEntry(index, 'certifications', e.target.value)}
                      placeholder="List any additional certifications, fellowships, or specializations for this degree"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <CardTitle>Availability Schedule</CardTitle>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addAvailabilityEntry}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Slot
                </Button>
              </div>
              <CardDescription>Share your consultation hours so patients can review your availability</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {availabilitySchedule.map((slot, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-4 relative">
                  {availabilitySchedule.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => removeAvailabilityEntry(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`day-${index}`}>Day</Label>
                      <Input
                        id={`day-${index}`}
                        value={slot.day}
                        onChange={(e) => updateAvailabilityEntry(index, 'day', e.target.value)}
                        placeholder="e.g., Monday"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`start-${index}`}>Start Time</Label>
                      <Input
                        id={`start-${index}`}
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateAvailabilityEntry(index, 'startTime', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`end-${index}`}>End Time</Label>
                      <Input
                        id={`end-${index}`}
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateAvailabilityEntry(index, 'endTime', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`availabilityNotes-${index}`}>Notes</Label>
                    <Input
                      id={`availabilityNotes-${index}`}
                      value={slot.notes}
                      onChange={(e) => updateAvailabilityEntry(index, 'notes', e.target.value)}
                      placeholder="e.g., In-person consultations only"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Work Information */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <CardTitle>Work Information</CardTitle>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addWorkEntry}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Work Experience
                </Button>
              </div>
              <CardDescription>Add your work experience and current positions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {workHistory.map((work, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-4 relative">
                  {workHistory.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => removeWorkEntry(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor={`hospital-${index}`}>Hospital/Clinic</Label>
                    <Input
                      id={`hospital-${index}`}
                      value={work.hospital}
                      onChange={(e) => updateWorkEntry(index, 'hospital', e.target.value)}
                      placeholder="e.g., City General Hospital"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`department-${index}`}>Department</Label>
                      <Input
                        id={`department-${index}`}
                        value={work.department}
                        onChange={(e) => updateWorkEntry(index, 'department', e.target.value)}
                        placeholder="e.g., Cardiology"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`position-${index}`}>Position</Label>
                      <Input
                        id={`position-${index}`}
                        value={work.position}
                        onChange={(e) => updateWorkEntry(index, 'position', e.target.value)}
                        placeholder="e.g., Senior Consultant"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Contact & Bio */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                <CardTitle>Contact & Biography</CardTitle>
              </div>
              <CardDescription>How patients can reach you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Office Address</Label>
                  <Input
                    id="address"
                    value={formData.office_address}
                    onChange={(e) => setFormData({ ...formData, office_address: e.target.value })}
                    placeholder="123 Medical Center Dr"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Professional Biography</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Brief description of your experience, expertise, and approach to patient care"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              disabled={loading}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                profileCompleted ? 'Save Profile' : 'Complete Profile'
              )}
            </Button>
          </div>
        </form>

        <Footer />
        </div>
      </div>
    </>
  );
}
