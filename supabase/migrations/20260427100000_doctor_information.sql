-- Create doctor_information table for storing doctor-specific details
CREATE TABLE IF NOT EXISTS public.doctor_information (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Professional Information
  medical_license_number TEXT,
  specialization TEXT,
  years_of_experience INTEGER,
  
  -- Education
  medical_degree TEXT,
  medical_school TEXT,
  graduation_year INTEGER,
  additional_certifications TEXT,
  
  -- Work Information
  current_hospital TEXT,
  department TEXT,
  position TEXT,
  
  -- Contact & Bio
  phone_number TEXT,
  office_address TEXT,
  bio TEXT,
  
  -- Profile Completion Status
  profile_completed BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.doctor_information ENABLE ROW LEVEL SECURITY;

-- RLS Policies for doctor_information
-- Doctors can view and update their own information
CREATE POLICY "Doctors can view own information" ON public.doctor_information
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Doctors can insert own information" ON public.doctor_information
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Doctors can update own information" ON public.doctor_information
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all doctor information
CREATE POLICY "Admins can view all doctor information" ON public.doctor_information
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all doctor information
CREATE POLICY "Admins can manage doctor information" ON public.doctor_information
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Patients can view their assigned doctors' information
CREATE POLICY "Patients can view assigned doctor information" ON public.doctor_information
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.doctor_assignments da
      WHERE da.doctor_id = doctor_information.user_id 
      AND da.patient_id = auth.uid()
    )
  );

-- Create trigger for updating timestamps
CREATE TRIGGER update_doctor_information_updated_at
  BEFORE UPDATE ON public.doctor_information
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_doctor_information_user_id ON public.doctor_information(user_id);
CREATE INDEX idx_doctor_information_profile_completed ON public.doctor_information(profile_completed);
