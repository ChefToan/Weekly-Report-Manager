import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Keep-alive function - fetches dog photo daily to prevent Supabase inactivity pause
async function keepDatabaseActive(supabase: any) {
  try {
    // Check if we need to fetch a new dog photo (if last one is older than 24 hours)
    const { data: lastPhoto } = await supabase
      .from('dog_photos')
      .select('fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    const now = new Date();
    const lastFetchTime = lastPhoto ? new Date(lastPhoto.fetched_at) : null;
    const hoursSinceLastFetch = lastFetchTime
      ? (now.getTime() - lastFetchTime.getTime()) / (1000 * 60 * 60)
      : 25; // If no photo exists, trigger fetch

    // Only fetch if it's been more than 24 hours
    if (hoursSinceLastFetch > 24) {
      // Fetch random dog photo from Dog CEO API
      const dogResponse = await fetch('https://dog.ceo/api/breeds/image/random');
      const dogData = await dogResponse.json();

      if (dogData.message) {
        // Delete photos older than 24 hours
        await supabase
          .from('dog_photos')
          .delete()
          .lt('fetched_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        // Insert new photo
        await supabase
          .from('dog_photos')
          .insert({
            image_url: dogData.message,
            fetched_at: now.toISOString(),
          });
      }
    }
  } catch (error) {
    // Silent fail - don't break auth if keep-alive fails
    console.error('Keep-alive error:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;


    if (!sessionToken) {
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

    // Run keep-alive in background (non-blocking)
    keepDatabaseActive(supabase).catch(console.error);

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