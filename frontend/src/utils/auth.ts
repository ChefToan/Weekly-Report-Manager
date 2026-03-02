import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  asu_id: string;
  role: 'admin' | 'user';
  is_active: boolean;
  last_login: string;
  created_at: string;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return null;
    }

    // Use service role client for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get session and user data
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select(`
        *,
        users (
          id,
          username,
          first_name,
          last_name,
          email,
          asu_id,
          role,
          is_active,
          last_login,
          created_at
        )
      `)
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session || !session.users) {
      return null;
    }

    const user = Array.isArray(session.users) ? session.users[0] : session.users;

    if (!user.is_active) {
      return null;
    }

    return user as User;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}