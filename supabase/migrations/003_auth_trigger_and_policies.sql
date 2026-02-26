-- 1. Create a function to handle new auth users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, email, role, display_name)
  VALUES (
    new.id, 
    new.email, 
    'assignee', -- Default to assignee
    -- Create a default display name from the first part of their email (e.g. jsmith@... -> Jsmith)
    INITCAP(SPLIT_PART(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger that calls the function whenever a user is added to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Add policy so Admins can update roles (for the Settings page)
-- First, drop the old policy if it exists just in case
DROP POLICY IF EXISTS "Admins can update user roles" ON user_roles;

CREATE POLICY "Admins can update user roles" ON user_roles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
