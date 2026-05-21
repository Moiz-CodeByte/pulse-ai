CREATE TABLE IF NOT EXISTS public.doctor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (patient_id, prescription_id)
);

ALTER TABLE public.doctor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own doctor reviews" ON public.doctor_reviews
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Doctors can view reviews about them" ON public.doctor_reviews
  FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Patients can review doctors after prescription" ON public.doctor_reviews
  FOR INSERT WITH CHECK (
    auth.uid() = patient_id
    AND EXISTS (
      SELECT 1
      FROM public.prescriptions p
      JOIN public.diagnosis d ON d.id = p.diagnosis_id
      JOIN public.mri_reports r ON r.id = d.report_id
      WHERE p.id = doctor_reviews.prescription_id
        AND p.doctor_id = doctor_reviews.doctor_id
        AND r.patient_id = auth.uid()
    )
  );

CREATE POLICY "Patients can update own doctor reviews" ON public.doctor_reviews
  FOR UPDATE USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

CREATE OR REPLACE FUNCTION public.update_doctor_review_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_doctor_id UUID;
BEGIN
  target_doctor_id := COALESCE(NEW.doctor_id, OLD.doctor_id);

  UPDATE public.doctor_information
  SET
    average_rating = review_stats.average_rating,
    total_reviews = review_stats.total_reviews,
    updated_at = now()
  FROM (
    SELECT
      AVG(rating)::NUMERIC(3, 2) AS average_rating,
      COUNT(*)::INTEGER AS total_reviews
    FROM public.doctor_reviews
    WHERE doctor_id = target_doctor_id
  ) AS review_stats
  WHERE user_id = target_doctor_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS doctor_reviews_update_totals ON public.doctor_reviews;
CREATE TRIGGER doctor_reviews_update_totals
AFTER INSERT OR UPDATE OR DELETE ON public.doctor_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_doctor_review_totals();
