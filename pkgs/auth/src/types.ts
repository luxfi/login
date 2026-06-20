/**
 * The auth methods the Lux unified login offers. Deliberately scoped:
 * email OTP, phone OTP, GitHub, Google, Web3 wallet. No WebAuthn / FaceID.
 */
export type AuthMethod = 'email' | 'phone' | 'github' | 'google' | 'web3'

/** The two passwordless OTP channels. */
export type OtpChannel = Extract<AuthMethod, 'email' | 'phone'>

/** The three federated/wallet providers, in canonical display order. */
export type SocialProvider = Extract<AuthMethod, 'github' | 'google' | 'web3'>

/**
 * IAM provider key passed to the authorize endpoint's `provider` param.
 * IAM records providers as `provider-<key>`; the bare key is what the
 * `@hanzo/iam` SDK forwards via `signinRedirect({ additionalParams })`.
 * The Web3Onboard wallet provider maps to `web3`.
 */
export const PROVIDER_KEY: Record<SocialProvider, string> = {
  github: 'github',
  google: 'google',
  web3: 'web3',
}

export const SOCIAL_ORDER: readonly SocialProvider[] = ['github', 'google', 'web3'] as const
