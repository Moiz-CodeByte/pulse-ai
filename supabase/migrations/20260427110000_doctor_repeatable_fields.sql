-- Modify doctor_information table to support repeatable education and work fields

-- First, migrate existing data to new structure
-- Create temporary columns for the new JSONB arrays
ALTER TABLE public.doctor_information 
  ADD COLUMN education_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN work_history JSONB DEFAULT '[]'::jsonb;

-- Migrate existing education data to array format (if exists)
UPDATE public.doctor_information
SET education_history = 
  CASE 
    WHEN medical_degree IS NOT NULL OR medical_school IS NOT NULL THEN
      jsonb_build_array(
        jsonb_build_object(
          'degree', COALESCE(medical_degree, ''),
          'school', COALESCE(medical_school, ''),
          'graduationYear', graduation_year,
          'certifications', COALESCE(additional_certifications, '')
        )
      )
    ELSE '[]'::jsonb
  END
WHERE medical_degree IS NOT NULL OR medical_school IS NOT NULL;

-- Migrate existing work data to array format (if exists)
UPDATE public.doctor_information
SET work_history = 
  CASE 
    WHEN current_hospital IS NOT NULL OR department IS NOT NULL OR position IS NOT NULL THEN
      jsonb_build_array(
        jsonb_build_object(
          'hospital', COALESCE(current_hospital, ''),
          'department', COALESCE(department, ''),
          'position', COALESCE(position, '')
        )
      )
    ELSE '[]'::jsonb
  END
WHERE current_hospital IS NOT NULL OR department IS NOT NULL OR position IS NOT NULL;

-- Drop old columns (keep them commented for safety - uncomment after verifying migration)
-- ALTER TABLE public.doctor_information 
--   DROP COLUMN medical_degree,
--   DROP COLUMN medical_school,
--   DROP COLUMN graduation_year,
--   DROP COLUMN additional_certifications,
--   DROP COLUMN current_hospital,
--   DROP COLUMN department,
--   DROP COLUMN position;

-- For now, keep old columns but they will be deprecated
-- Comment indicates they are replaced by the new JSONB arrays
COMMENT ON COLUMN public.doctor_information.medical_degree IS 'DEPRECATED: Use education_history array instead';
COMMENT ON COLUMN public.doctor_information.medical_school IS 'DEPRECATED: Use education_history array instead';
COMMENT ON COLUMN public.doctor_information.graduation_year IS 'DEPRECATED: Use education_history array instead';
COMMENT ON COLUMN public.doctor_information.additional_certifications IS 'DEPRECATED: Use education_history array instead';
COMMENT ON COLUMN public.doctor_information.current_hospital IS 'DEPRECATED: Use work_history array instead';
COMMENT ON COLUMN public.doctor_information.department IS 'DEPRECATED: Use work_history array instead';
COMMENT ON COLUMN public.doctor_information.position IS 'DEPRECATED: Use work_history array instead';
