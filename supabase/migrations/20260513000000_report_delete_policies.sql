DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mri_reports'
      AND policyname = 'Patients can delete own reports'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Patients can delete own reports" ON public.mri_reports
        FOR DELETE USING (auth.uid() = patient_id)
    $policy$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mri_reports'
      AND policyname = 'Admins can delete all reports'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can delete all reports" ON public.mri_reports
        FOR DELETE USING (public.has_role(auth.uid(), 'admin'))
    $policy$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Patients can delete own MRI images'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Patients can delete own MRI images" ON storage.objects
        FOR DELETE USING (
          bucket_id = 'mri-images' AND
          auth.uid()::text = (storage.foldername(name))[1]
        )
    $policy$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins can delete all MRI images'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can delete all MRI images" ON storage.objects
        FOR DELETE USING (
          bucket_id = 'mri-images' AND
          public.has_role(auth.uid(), 'admin')
        )
    $policy$;
  END IF;
END
$$;
