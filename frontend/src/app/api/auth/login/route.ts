import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    
    console.log('Login attempt:', { username, passwordLength: password?.length });

    if (!username || !password) {
      return NextResponse.json({ error: 'Username or email and password are required' }, { status: 400 });
    }

    // Use service role client for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
      serviceKeyPrefix: serviceKey?.substring(0, 20) + '...'
    });

    if (!supabaseUrl || !serviceKey) {
      console.log('Missing environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Create service role client with proper configuration
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    });

    // Test the connection first
    console.log('Testing direct table access...');
    const testQuery = await supabase.rpc('version');
    console.log('Version test:', testQuery);

    // Find user by username or email
    const isEmail = username.includes('@');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq(isEmail ? 'email' : 'username', username.toLowerCase())
      .eq('is_active', true)
      .single();

    console.log('User query result:', { 
      userFound: !!user, 
      userError: userError?.message, 
      isActive: user?.is_active 
    });

    if (userError || !user) {
      console.log('User not found or error:', userError);
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    console.log('Password comparison result:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('Password mismatch');
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Create session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    console.log('Creating session:', { sessionToken: sessionToken.substring(0, 10) + '...', userId: user.id });

    const sessionResult = await supabase
      .from('user_sessions')
      .insert({
        user_id: user.id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString()
      });

    console.log('Session creation result:', { error: sessionResult.error?.message, success: !sessionResult.error });

    // Set session cookie
    const response = NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        asu_id: user.asu_id,
        role: user.role || 'user'
      }
    });
    
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt
    });

    console.log('Cookie set:', { 
      sessionToken: sessionToken.substring(0, 10) + '...',
      expires: expiresAt.toISOString(),
      production: process.env.NODE_ENV === 'production'
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}