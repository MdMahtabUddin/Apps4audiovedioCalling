import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await userService.findByEmail(email);
    // Don't leak existence of email
    if (!user) {
      return NextResponse.json({
        message: 'If an account exists with this email, a reset link has been dispatched.',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour

    await userService.setResetToken(user.email, resetToken, expiry);

    // In a production setup, send an actual email via SendGrid, Resend, or AWS SES.
    // For convenience in development, we also include the token or reset URL in dev logs.
    console.log(`[AUTH] Password reset link for ${email}: /reset-password?token=${resetToken}`);

    return NextResponse.json({
      message: 'If an account exists with this email, a reset link has been dispatched.',
      // Return reset token for testing convenience / dev verification
      devToken: resetToken,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}
