import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    // Use service role client for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find user by username
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (userError) {
      return NextResponse.json({ 
        debug: {
          userFound: false,
          userError: userError.message,
          searchedUsername: username
        }
      });
    }

    if (!user) {
      return NextResponse.json({ 
        debug: {
          userFound: false,
          message: 'No user found with this username'
        }
      });
    }

    // Test password comparison
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    return NextResponse.json({
      debug: {
        userFound: true,
        username: user.username,
        hashedPassword: user.password_hash,
        passwordMatch,
        isActive: user.is_active,
        providedPassword: password
      }
    });

  } catch (error) {
    return NextResponse.json({ 
      debug: {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}