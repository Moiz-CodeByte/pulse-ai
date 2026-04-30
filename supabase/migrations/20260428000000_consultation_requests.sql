-- Create consultation requests table for patients to send reports to doctors
-- This table tracks when patients request consultation from doctors
-- Future-proof for implementing chat functionality

CREATE TYPE consultation_status AS ENUM ('pending', 'accepted', 'rejected', 'completed');

CREATE TABLE public.consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Nullable: patient can request any available doctor
  report_id UUID REFERENCES public.mri_reports(id) ON DELETE CASCADE NOT NULL,
  
  -- Patient provided information
  patient_message TEXT, -- Optional message from patient
  patient_details JSONB DEFAULT '{}'::jsonb, -- Contact info, symptoms, urgency, etc.
  
  -- Request status tracking
  status consultation_status DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  doctor_notes TEXT, -- Doctor's notes when accepting/rejecting
  
  -- For future chat functionality
--   chat_enabled BOOLEAN DEFAULT false,
--   last_message_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE (patient_id, doctor_id, report_id) -- Prevent duplicate requests for same doctor-patient-report combination
);

-- Enable RLS
ALTER TABLE public.consultation_requests ENABLE ROW LEVEL SECURITY;

-- Patients can view their own consultation requests
CREATE POLICY "Patients can view own consultation requests" ON public.consultation_requests
  FOR SELECT USING (auth.uid() = patient_id);

-- Patients can create consultation requests
CREATE POLICY "Patients can create consultation requests" ON public.consultation_requests
  FOR INSERT WITH CHECK (
    auth.uid() = patient_id AND
    public.has_role(auth.uid(), 'patient')
  );

-- Patients can update their own pending requests (to cancel or modify)
CREATE POLICY "Patients can update own pending requests" ON public.consultation_requests
  FOR UPDATE USING (
    auth.uid() = patient_id AND 
    status = 'pending'
  )
  WITH CHECK (
    auth.uid() = patient_id
  );

-- Doctors can view consultation requests addressed to them or any doctor (doctor_id IS NULL)
CREATE POLICY "Doctors can view consultation requests" ON public.consultation_requests
  FOR SELECT USING (
    public.has_role(auth.uid(), 'doctor') AND
    (doctor_id = auth.uid() OR doctor_id IS NULL)
  );

-- Doctors can update consultation requests to accept/reject
CREATE POLICY "Doctors can respond to consultation requests" ON public.consultation_requests
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'doctor') AND
    (doctor_id = auth.uid() OR doctor_id IS NULL)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'doctor')
  );

-- Admins can view all consultation requests
CREATE POLICY "Admins can view all consultation requests" ON public.consultation_requests
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all consultation requests
CREATE POLICY "Admins can manage consultation requests" ON public.consultation_requests
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX idx_consultation_requests_patient ON public.consultation_requests(patient_id);
CREATE INDEX idx_consultation_requests_doctor ON public.consultation_requests(doctor_id);
CREATE INDEX idx_consultation_requests_status ON public.consultation_requests(status);
CREATE INDEX idx_consultation_requests_report ON public.consultation_requests(report_id);

-- Function to automatically create doctor_assignment when consultation is accepted
CREATE OR REPLACE FUNCTION public.handle_consultation_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When status changes to 'accepted', create doctor assignment if it doesn't exist
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' AND NEW.doctor_id IS NOT NULL THEN
    INSERT INTO public.doctor_assignments (doctor_id, patient_id, report_id)
    VALUES (NEW.doctor_id, NEW.patient_id, NEW.report_id)
    ON CONFLICT (doctor_id, report_id) DO NOTHING;
    
    NEW.responded_at = NOW();
  END IF;
  
  -- Update responded_at when status changes from pending
  IF NEW.status != 'pending' AND OLD.status = 'pending' THEN
    NEW.responded_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for consultation acceptance
CREATE TRIGGER on_consultation_accepted
  BEFORE UPDATE ON public.consultation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_consultation_accepted();

-- Add helpful comments
COMMENT ON TABLE public.consultation_requests IS 'Tracks patient requests to send MRI reports to doctors for consultation';
COMMENT ON COLUMN public.consultation_requests.doctor_id IS 'Specific doctor requested (NULL means patient wants any available doctor)';
COMMENT ON COLUMN public.consultation_requests.patient_details IS 'JSON containing patient contact info, symptoms, urgency level, preferred contact method, etc.';
COMMENT ON COLUMN public.consultation_requests.chat_enabled IS 'Future feature: Enable chat between patient and doctor for this consultation';
