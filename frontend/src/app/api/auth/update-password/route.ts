import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { token, password, email } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    // Strengthen password requirements
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    // Check password complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    const complexityCount = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
    
    if (complexityCount < 3) {
      return NextResponse.json({ 
        error: 'Password must contain at least 3 of the following: uppercase letters, lowercase letters, numbers, special characters' 
      }, { status: 400 });
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

    // Since we're not storing tokens in DB yet, we'll use a simple approach
    // In a real implementation, you'd validate the token from the database

    // TEMPORARY: Since we don't have token storage working yet,
    // we'll decode the token to find which user this belongs to
    // In production, you MUST validate tokens from the database!
    
    // For development, let's look for the most recently requested reset
    // by finding users and checking against recent console logs
    // This is NOT secure - implement proper token validation!
    
    // Get user by email if provided, otherwise return error
    if (!email) {
      return NextResponse.json({ error: 'Email is required for password reset' }, { status: 400 });
    }

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name')
      .eq('email', email.toLowerCase())
      .single();

    if (userError || !users) {
      console.error('User lookup error:', userError);
      return NextResponse.json({ error: 'Invalid reset token or user not found' }, { status: 400 });
    }

    const user = users;

    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update the user's password
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        password_hash: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    // In a real implementation, you'd also:
    // 1. Delete the used reset token from the database
    // 2. Invalidate all user sessions
    // 3. Send a confirmation email


    return NextResponse.json({ 
      success: true, 
      message: 'Password updated successfully' 
    });

  } catch (error) {
    console.error('Password update error:', error);
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
  }
}