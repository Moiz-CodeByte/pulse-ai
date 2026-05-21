CREATE POLICY "Public can view verified doctor roles" ON public.user_roles
  FOR SELECT USING (
    role = 'doctor' AND COALESCE(verified, false) = true
  );

CREATE POLICY "Public can view verified doctor profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = profiles.id
        AND ur.role = 'doctor'
        AND COALESCE(ur.verified, false) = true
    )
  );

CREATE POLICY "Public can view verified doctor information" ON public.doctor_information
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = doctor_information.user_id
        AND ur.role = 'doctor'
        AND COALESCE(ur.verified, false) = true
    )
  );
