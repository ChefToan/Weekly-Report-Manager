import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Helper function to validate admin access
async function validateAdminAccess() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  if (!sessionToken) {
    return { error: 'No session found', status: 401 };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  );

  const { data: session, error: sessionError } = await supabase
    .from('user_sessions')
    .select(`
      *,
      users (
        id,
        username,
        role,
        is_active
      )
    `)
    .eq('session_token', sessionToken)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (sessionError || !session || !session.users) {
    return { error: 'Invalid session', status: 401 };
  }

  const user = Array.isArray(session.users) ? session.users[0] : session.users;

  if (!user.is_active || user.role !== 'admin') {
    return { error: 'Admin access required', status: 403 };
  }

  return { user, supabase };
}

// GET - List all users
export async function GET(request: NextRequest) {
  try {
    const validation = await validateAdminAccess();
    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { supabase } = validation;

    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, first_name, last_name, email, asu_id, role, is_active, last_login, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}