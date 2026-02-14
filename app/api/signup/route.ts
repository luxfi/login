import { NextRequest, NextResponse } from 'next/server'

const IAM_URL = process.env.IAM_URL ?? 'https://iam.hanzo.ai'
const IAM_ORG = process.env.NEXT_PUBLIC_IAM_ORG ?? 'lux'
const IAM_APP = process.env.IAM_APP ?? 'app-lux'
const REDIRECT_URL = process.env.NEXT_PUBLIC_REDIRECT_URL ?? 'https://cloud.lux.network'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 },
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      )
    }

    // Register via IAM (Casdoor signup API)
    const res = await fetch(`${IAM_URL}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        application: IAM_APP,
        organization: IAM_ORG,
        username: email,
        name,
        email,
        password,
        type: 'signup',
      }),
    })

    const data = await res.json()

    if (data.status === 'error') {
      return NextResponse.json(
        { error: data.msg ?? 'Signup failed' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      redirect: REDIRECT_URL,
      token: data.data,
    })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
