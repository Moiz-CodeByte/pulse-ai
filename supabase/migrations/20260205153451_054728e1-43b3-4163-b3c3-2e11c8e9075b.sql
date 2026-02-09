-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('patient', 'doctor', 'admin');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'patient',
  verified BOOLEAN DEFAULT FALSE,
  UNIQUE (user_id, role)
);

-- Create MRI reports table
CREATE TABLE public.mri_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create diagnosis table
CREATE TABLE public.diagnosis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.mri_reports(id) ON DELETE CASCADE NOT NULL UNIQUE,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  confidence DECIMAL(5,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create prescriptions table
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID REFERENCES public.diagnosis(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  medicine TEXT NOT NULL,
  dosage TEXT,
  instructions TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create doctor assignments table
CREATE TABLE public.doctor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES public.mri_reports(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (doctor_id, report_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mri_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_assignments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Doctors can view patient profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'doctor') AND
    EXISTS (
      SELECT 1 FROM public.doctor_assignments da
      WHERE da.doctor_id = auth.uid() AND da.patient_id = profiles.id
    )
  );

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- MRI reports policies
CREATE POLICY "Patients can view own reports" ON public.mri_reports
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Patients can insert own reports" ON public.mri_reports
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Doctors can view assigned reports" ON public.mri_reports
  FOR SELECT USING (
    public.has_role(auth.uid(), 'doctor') AND
    EXISTS (
      SELECT 1 FROM public.doctor_assignments da
      WHERE da.doctor_id = auth.uid() AND da.report_id = mri_reports.id
    )
  );

CREATE POLICY "Admins can view all reports" ON public.mri_reports
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Diagnosis policies
CREATE POLICY "Patients can view own diagnosis" ON public.diagnosis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.mri_reports mr
      WHERE mr.id = diagnosis.report_id AND mr.patient_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can view and insert diagnosis" ON public.diagnosis
  FOR ALL USING (
    public.has_role(auth.uid(), 'doctor') AND
    EXISTS (
      SELECT 1 FROM public.doctor_assignments da
      WHERE da.doctor_id = auth.uid() AND da.report_id = diagnosis.report_id
    )
  );

CREATE POLICY "Admins can manage diagnosis" ON public.diagnosis
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Prescriptions policies
CREATE POLICY "Patients can view own prescriptions" ON public.prescriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.diagnosis d
      JOIN public.mri_reports mr ON mr.id = d.report_id
      WHERE d.id = prescriptions.diagnosis_id AND mr.patient_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can manage prescriptions" ON public.prescriptions
  FOR ALL USING (
    public.has_role(auth.uid(), 'doctor') AND
    (doctor_id = auth.uid() OR doctor_id IS NULL)
  );

CREATE POLICY "Admins can view all prescriptions" ON public.prescriptions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Doctor assignments policies
CREATE POLICY "Doctors can view own assignments" ON public.doctor_assignments
  FOR SELECT USING (doctor_id = auth.uid());

CREATE POLICY "Patients can view own assignments" ON public.doctor_assignments
  FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY "Admins can manage assignments" ON public.doctor_assignments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for MRI images
INSERT INTO storage.buckets (id, name, public) VALUES ('mri-images', 'mri-images', false);

-- Storage policies
CREATE POLICY "Patients can upload own MRI images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'mri-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own MRI images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'mri-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Doctors can view assigned patient images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'mri-images' AND
    public.has_role(auth.uid(), 'doctor') AND
    EXISTS (
      SELECT 1 FROM public.doctor_assignments da
      WHERE da.doctor_id = auth.uid() AND da.patient_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Admins can view all MRI images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'mri-images' AND
    public.has_role(auth.uid(), 'admin')
  );

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mri_reports_updated_at
  BEFORE UPDATE ON public.mri_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();