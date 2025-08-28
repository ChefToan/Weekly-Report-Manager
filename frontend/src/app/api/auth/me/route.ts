import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    console.log('Auth check - session token:', sessionToken ? sessionToken.substring(0, 10) + '...' : 'none');

    if (!sessionToken) {
      console.log('No session token found in cookies');
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
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
    console.log('Querying session with token:', sessionToken.substring(0, 10) + '...');
    
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

    console.log('Session query result:', { 
      found: !!session, 
      error: sessionError?.message,
      hasUsers: !!(session && session.users)
    });

    if (sessionError || !session || !session.users) {
      console.log('Session validation failed:', { sessionError, hasSession: !!session, hasUsers: !!(session && session.users) });
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const user = Array.isArray(session.users) ? session.users[0] : session.users;

    if (!user.is_active) {
      return NextResponse.json({ error: 'Account is not active' }, { status: 403 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Authentication check error:', error);
    return NextResponse.json({ error: 'Authentication check failed' }, { status: 500 });
  }
}