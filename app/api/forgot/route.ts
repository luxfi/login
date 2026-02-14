import { NextRequest, NextResponse } from 'next/server'

const IAM_URL = process.env.IAM_URL ?? 'https://iam.hanzo.ai'
const IAM_ORG = process.env.NEXT_PUBLIC_IAM_ORG ?? 'lux'
const IAM_APP = process.env.IAM_APP ?? 'app-lux'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 },
      )
    }

    // Send password reset via IAM (Casdoor forgot password API)
    const res = await fetch(`${IAM_URL}/api/send-verification-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        application: IAM_APP,
        organization: IAM_ORG,
        dest: email,
        type: 'reset',
      }),
    })

    const data = await res.json()

    if (data.status === 'error') {
      // Don't leak whether email exists
      console.error('Forgot password error:', data.msg)
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Forgot password error:', err)
    // Still return success to prevent enumeration
    return NextResponse.json({ ok: true })
  }
}
