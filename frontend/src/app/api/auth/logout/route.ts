import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (sessionToken) {
      // Use service role client for admin operations
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Delete session from database
      await supabase
        .from('user_sessions')
        .delete()
        .eq('session_token', sessionToken);
    }

    // Clear session cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete('session_token');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    const response = NextResponse.json({ success: true }); // Always succeed for logout
    response.cookies.delete('session_token');
    return response;
  }
}