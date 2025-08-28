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

// Generate random code
function generateRegistrationCode(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// GET - List all registration codes
export async function GET(request: NextRequest) {
  try {
    const validation = await validateAdminAccess();
    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { supabase } = validation;

    const { data: codes, error } = await supabase
      .from('registration_codes')
      .select(`
        *,
        created_by_user:users!registration_codes_created_by_fkey (
          username,
          first_name,
          last_name
        ),
        used_by_user:users!registration_codes_used_by_fkey (
          username,
          first_name,
          last_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching registration codes:', error);
      return NextResponse.json({ error: 'Failed to fetch registration codes' }, { status: 500 });
    }

    return NextResponse.json({ codes });
  } catch (error) {
    console.error('Registration codes GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new registration code
export async function POST(request: NextRequest) {
  try {
    const validation = await validateAdminAccess();
    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { user, supabase } = validation;
    const { expiresInHours = 24 } = await request.json();

    // Generate unique code
    let code = generateRegistrationCode();
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure code is unique
    while (attempts < maxAttempts) {
      const { data: existing } = await supabase
        .from('registration_codes')
        .select('id')
        .eq('code', code)
        .single();

      if (!existing) break;
      
      code = generateRegistrationCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 });
    }

    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const { data: newCode, error: insertError } = await supabase
      .from('registration_codes')
      .insert({
        code,
        created_by: user.id,
        expires_at: expiresAt.toISOString()
      })
      .select(`
        *,
        created_by_user:users!registration_codes_created_by_fkey (
          username,
          first_name,
          last_name
        )
      `)
      .single();

    if (insertError) {
      console.error('Error creating registration code:', insertError);
      return NextResponse.json({ error: 'Failed to create registration code' }, { status: 500 });
    }

    return NextResponse.json({ code: newCode });
  } catch (error) {
    console.error('Registration code POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete registration code
export async function DELETE(request: NextRequest) {
  try {
    const validation = await validateAdminAccess();
    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { supabase } = validation;
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('id');

    if (!codeId) {
      return NextResponse.json({ error: 'Code ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('registration_codes')
      .delete()
      .eq('id', codeId);

    if (error) {
      console.error('Error deleting registration code:', error);
      return NextResponse.json({ error: 'Failed to delete registration code' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Registration code DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}