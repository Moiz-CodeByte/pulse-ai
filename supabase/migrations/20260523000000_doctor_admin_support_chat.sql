CREATE POLICY "Doctors can view admin roles for support chat" ON public.user_roles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'doctor')
    AND role = 'admin'
  );

CREATE POLICY "Doctors can view admin profiles for support chat" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'doctor')
    AND public.has_role(profiles.id, 'admin')
  );
