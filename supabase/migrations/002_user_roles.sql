-- 1. Create enum for roles
CREATE TYPE user_role AS ENUM ('admin', 'assignee');

-- 2. Create the roles table
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'assignee',
    display_name TEXT NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id),
    UNIQUE(email)
);

-- 3. Enable RLS but allow anyone to read (so the app can check roles)
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read user roles" ON user_roles FOR SELECT USING (true);

-- Usage Example (Run these manually in Supabase):
-- INSERT INTO user_roles (user_id, email, role, display_name) 
-- VALUES ('auth_user_id_here', 'suriyakumar@...', 'admin', 'Suriya Kumar');
