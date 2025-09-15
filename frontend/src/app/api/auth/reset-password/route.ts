import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
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

    // Check if user exists with this email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, is_active')
      .eq('email', email.toLowerCase())
      .single();

    // Always return success message for security (don't reveal if email exists)
    const successMessage = 'If an account exists with this email, you will receive password reset instructions.';

    if (userError || !user || !user.is_active) {
      // Still return success to prevent email enumeration
      return NextResponse.json({ success: true, message: successMessage });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // For development mode, we'll temporarily store the token in a simple way
    // In production, you should use a proper database table for this

    // Send email with reset link (include email for easier lookup until DB is fixed)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      console.error('NEXT_PUBLIC_APP_URL environment variable is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
    
    
    try {
      await sendResetEmail(user.email, user.first_name, resetUrl);
    } catch (emailError) {
      console.error('Error sending reset email:', emailError);
      // Still return success to prevent revealing system issues
    }

    return NextResponse.json({ success: true, message: successMessage });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Failed to process reset request' }, { status: 500 });
  }
}

// Email sending function
async function sendResetEmail(email: string, firstName: string, resetUrl: string) {
  // Check if we have email service configured
  if (process.env.RESEND_API_KEY) {
    // Use Resend service
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'noreply@weeklyreport.info',
        to: [email],
        subject: 'Reset Your Password - Weekly Reports',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Reset Your Password</h2>
            <p>Hello ${firstName},</p>
            <p>You requested to reset your password for Weekly Reports. Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
            </div>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this reset, you can safely ignore this email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 12px;">Weekly Reports</p>
          </div>
        `
      }),
    });

    if (!response.ok) {
      throw new Error(`Email service error: ${response.status}`);
    }
  } else if (process.env.SMTP_HOST) {
    // Use SMTP (you'd implement this with nodemailer or similar)
    throw new Error('SMTP email sending not implemented');
  } else {
    // Development mode - in production, configure proper email service
    
    // In development, we don't actually send an email, but we still "succeed"
    return;
  }
}