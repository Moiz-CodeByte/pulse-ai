-- Allow patients to view doctor roles (so they can discover available doctors)
CREATE POLICY "Patients can view doctor roles" ON public.user_roles
  FOR SELECT USING (
    role = 'doctor' AND
    public.has_role(auth.uid(), 'patient')
  );

-- Allow patients to view doctor profiles (so they can see doctor names)
CREATE POLICY "Patients can view doctor profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'patient') AND
    public.has_role(profiles.id, 'doctor')
  );
