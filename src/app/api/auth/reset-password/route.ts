import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const user = await userService.findByResetToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);
    await userService.updatePassword(user.id, newHash);
    await userService.setResetToken(user.email, '', new Date(0));

    return NextResponse.json({
      message: 'Password reset successfully. You may now log in.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
