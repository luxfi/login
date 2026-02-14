import { NextRequest, NextResponse } from 'next/server'

const IAM_URL = process.env.IAM_URL ?? 'https://iam.hanzo.ai'
const IAM_ORG = process.env.NEXT_PUBLIC_IAM_ORG ?? 'lux'
const IAM_APP = process.env.IAM_APP ?? 'app-lux'
const REDIRECT_URL = process.env.NEXT_PUBLIC_REDIRECT_URL ?? 'https://cloud.lux.network'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      )
    }

    // Authenticate against IAM (Casdoor login API)
    const res = await fetch(`${IAM_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        application: IAM_APP,
        organization: IAM_ORG,
        username: email,
        password,
        type: 'login',
      }),
    })

    const data = await res.json()

    if (data.status === 'error' || !data.data) {
      return NextResponse.json(
        { error: data.msg ?? 'Invalid credentials' },
        { status: 401 },
      )
    }

    return NextResponse.json({
      redirect: REDIRECT_URL,
      token: data.data,
    })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
