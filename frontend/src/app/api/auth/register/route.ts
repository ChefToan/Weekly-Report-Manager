import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { firstName, lastName, email, asuId, username, password, confirmPassword, registrationCode } = await request.json();
    
    console.log('Registration attempt:', { username, email, asuId, registrationCode, passwordLength: password?.length });

    // Basic validation
    if (!firstName || !lastName || !email || !asuId || !username || !password || !confirmPassword || !registrationCode) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Validate ASU email
    if (!email.includes('@asu.edu')) {
      return NextResponse.json({ error: 'Email must be a valid ASU email address (@asu.edu)' }, { status: 400 });
    }

    // Validate ASU ID
    if (!/^\d{10}$/.test(asuId)) {
      return NextResponse.json({ error: 'ASU ID must be exactly 10 digits' }, { status: 400 });
    }

    // Validate name fields
    if (firstName.trim().length < 2) {
      return NextResponse.json({ error: 'First name must be at least 2 characters long' }, { status: 400 });
    }

    if (lastName.trim().length < 2) {
      return NextResponse.json({ error: 'Last name must be at least 2 characters long' }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ error: 'Username must be at least 3 characters long' }, { status: 400 });
    }

    // Use service role client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if username, email, or ASU ID already exists
    const { data: existingUsers } = await supabase
      .from('users')
      .select('username, email, asu_id')
      .or(`username.eq.${username.trim().toLowerCase()},email.eq.${email.trim().toLowerCase()},asu_id.eq.${asuId.trim()}`);

    if (existingUsers && existingUsers.length > 0) {
      const existing = existingUsers[0];
      if (existing.username === username.trim().toLowerCase()) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
      }
      if (existing.email === email.trim().toLowerCase()) {
        return NextResponse.json({ error: 'Email address already registered' }, { status: 409 });
      }
      if (existing.asu_id === asuId.trim()) {
        return NextResponse.json({ error: 'ASU ID already registered' }, { status: 409 });
      }
    }

    // Validate registration code
    const { data: regCode, error: codeError } = await supabase
      .from('registration_codes')
      .select('*')
      .eq('code', registrationCode.trim())
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (codeError || !regCode) {
      console.log('Registration code validation failed:', codeError);
      return NextResponse.json({ error: 'Invalid or expired registration code' }, { status: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        username: username.trim().toLowerCase(),
        password_hash: passwordHash,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        asu_id: asuId.trim(),
        role: 'user',
        is_active: true
      })
      .select('id, username, first_name, last_name, email, asu_id, role')
      .single();

    if (userError) {
      console.error('Error creating user:', userError);
      return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 });
    }

    // Mark registration code as used
    const { error: updateCodeError } = await supabase
      .from('registration_codes')
      .update({
        is_used: true,
        used_by: newUser.id
      })
      .eq('id', regCode.id);

    if (updateCodeError) {
      console.error('Error updating registration code:', updateCodeError);
      // User is created, so we don't fail the registration
    }

    console.log('User registered successfully:', { userId: newUser.id, username: newUser.username, email: newUser.email });

    return NextResponse.json({ 
      success: true, 
      message: 'Account created successfully. You can now log in.',
      user: {
        id: newUser.id,
        username: newUser.username,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        email: newUser.email,
        asu_id: newUser.asu_id,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}