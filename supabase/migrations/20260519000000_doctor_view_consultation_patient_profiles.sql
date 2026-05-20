CREATE POLICY "Doctors can view consultation patient profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'doctor') AND
    EXISTS (
      SELECT 1
      FROM public.consultation_requests cr
      WHERE cr.patient_id = profiles.id
        AND (cr.doctor_id = auth.uid() OR cr.doctor_id IS NULL)
    )
  );
