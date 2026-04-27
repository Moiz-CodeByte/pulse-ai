-- Create function for admins to create users
-- This uses the auth.users table and requires proper permissions

-- Drop existing functions if they exist with different signatures
DROP FUNCTION IF EXISTS public.admin_create_user(TEXT, TEXT, TEXT, app_role, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_delete_user(UUID);

-- Function to create a new user (admin only)
CREATE OR REPLACE FUNCTION public.admin_create_user(
  user_email TEXT,
  user_password TEXT,
  user_full_name TEXT,
  user_role app_role,
  is_verified BOOLEAN DEFAULT TRUE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id UUID;
  result JSON;
BEGIN
  -- Check if the calling user is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Validate inputs
  IF user_email IS NULL OR user_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF user_password IS NULL OR user_password = '' THEN
    RAISE EXCEPTION 'Password is required';
  END IF;

  IF LENGTH(user_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  IF user_full_name IS NULL OR user_full_name = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();

  -- Insert into auth.users (this requires supabase_auth_admin role or extensions)
  -- Since we can't directly insert into auth.users from a normal function,
  -- we'll return the data needed for the application to complete the signup
  
  -- Instead, we'll use a different approach:
  -- The admin will provide credentials, and we'll create a temporary invitation record
  -- Then the application can complete the signup process
  
  -- For now, let's return an error message explaining the limitation
  RAISE EXCEPTION 'Direct user creation requires service role access. Please use the Supabase Admin API or create an Edge Function.';
  
  RETURN json_build_object(
    'success', false,
    'message', 'This function requires additional setup'
  );
END;
$$;

-- Function to delete a user (admin only)
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  target_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Check if the calling user is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Prevent deleting own account
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Delete user roles
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- Delete profile
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- The CASCADE on foreign keys will handle related records
  -- Note: This does NOT delete from auth.users - that requires admin API
  
  RETURN json_build_object(
    'success', true,
    'message', 'User data deleted successfully',
    'note', 'Auth user still exists - requires admin API to fully delete'
  );
END;
$$;

-- Grant execute permissions to authenticated users (the function checks admin role internally)
GRANT EXECUTE ON FUNCTION public.admin_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user TO authenticated;
