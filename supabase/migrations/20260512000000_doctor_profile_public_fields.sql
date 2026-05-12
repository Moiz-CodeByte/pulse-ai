ALTER TABLE public.doctor_information
  ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS availability_schedule JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3, 2),
  ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

CREATE POLICY "Patients can view verified doctor information" ON public.doctor_information
  FOR SELECT USING (
    public.has_role(auth.uid(), 'patient') AND
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = doctor_information.user_id
        AND ur.role = 'doctor'
        AND COALESCE(ur.verified, false) = true
    )
  );
