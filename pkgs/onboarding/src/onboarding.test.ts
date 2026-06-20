/**
 * Onboarding unit tests — run with the Node built-in test runner and native
 * TypeScript stripping (no test-framework dependency):
 *
 *   node --test --experimental-strip-types 'src/**\/*.test.ts'
 *
 * Covers the React-free surface: the flow machine (reveals, validation, resume
 * point), the country-risk screening, and the service's request shaping + IAM
 * response translation (with an injected fake fetch).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXCHANGE_FULL, LITE, flowById } from './domain/flows.ts'
import {
  activeSteps,
  nextStepId,
  prevStepId,
  firstStepId,
  isLastStep,
  visibleFields,
  validateStep,
  isStepComplete,
  firstIncompleteStep,
  isFlowComplete,
  stepById,
  stepCompletionKey,
} from './domain/machine.ts'
import { screenCountry } from './domain/screening.ts'
import { createOnboardingService } from './service/onboarding.ts'
import type { FormData } from './domain/types.ts'

// ── Flow registry ───────────────────────────────────────────────────

test('flowById defaults to exchange-full, resolves lite explicitly', () => {
  assert.equal(flowById(undefined).id, 'exchange-full')
  assert.equal(flowById('exchange-full').id, 'exchange-full')
  assert.equal(flowById('lite').id, 'lite')
  assert.equal(flowById('garbage').id, 'exchange-full')
})

// ── Machine: enabledWhen reveals ────────────────────────────────────

test('individual path hides entity + entity-document steps', () => {
  const data: FormData = { accountType: 'individual' }
  const ids = activeSteps(EXCHANGE_FULL, data).map((s) => s.id)
  assert.ok(ids.includes('identity'))
  assert.ok(ids.includes('document')) // individual gets document+selfie
  assert.ok(!ids.includes('entity'))
  assert.ok(!ids.includes('entity-document'))
})

test('corporate path reveals entity steps and hides the individual document', () => {
  const data: FormData = { accountType: 'corporate' }
  const ids = activeSteps(EXCHANGE_FULL, data).map((s) => s.id)
  assert.ok(ids.includes('entity'))
  assert.ok(ids.includes('entity-document'))
  assert.ok(!ids.includes('document')) // the individual doc step is hidden
})

test('nextStepId / prevStepId skip disabled steps in both directions', () => {
  const data: FormData = { accountType: 'individual' }
  // account-type → identity (entity is skipped for individuals)
  assert.equal(nextStepId(EXCHANGE_FULL, data, 'account-type'), 'identity')
  assert.equal(prevStepId(EXCHANGE_FULL, data, 'identity'), 'account-type')
  // identity → document (entity skipped going forward too)
  assert.equal(nextStepId(EXCHANGE_FULL, data, 'identity'), 'document')
})

test('firstStepId is account-type; review is the last active step', () => {
  const data: FormData = { accountType: 'individual' }
  assert.equal(firstStepId(EXCHANGE_FULL, data), 'account-type')
  assert.equal(isLastStep(EXCHANGE_FULL, data, 'review'), true)
  assert.equal(isLastStep(EXCHANGE_FULL, data, 'identity'), false)
  assert.equal(nextStepId(EXCHANGE_FULL, data, 'review'), null)
})

// ── Machine: visibleWhen field reveals ──────────────────────────────

test('SSN-last4 shows for US, tax ID shows for non-US', () => {
  const identity = stepById(EXCHANGE_FULL, 'identity')!
  const us = visibleFields(identity, { country: 'US' }).map((f) => f.name)
  assert.ok(us.includes('ssnLast4'))
  assert.ok(!us.includes('taxId'))

  const intl = visibleFields(identity, { country: 'GB' }).map((f) => f.name)
  assert.ok(intl.includes('taxId'))
  assert.ok(!intl.includes('ssnLast4'))
})

// ── Machine: validation ─────────────────────────────────────────────

test('a required field blocks until filled; hidden fields are not required', () => {
  const identity = stepById(EXCHANGE_FULL, 'identity')!
  // Empty US applicant: legal name etc. missing.
  const empty = validateStep(identity, { country: 'US' })
  assert.ok(empty.legalFirstName)
  assert.ok(empty.ssnLast4) // required + visible for US
  assert.ok(!('taxId' in empty)) // hidden for US → not required

  // Fully-filled US individual identity.
  const full: FormData = {
    legalFirstName: 'Ada',
    legalLastName: 'Lovelace',
    dob: '1990-01-01',
    country: 'US',
    addressLine1: '1 Analytical Way',
    city: 'London',
    state: 'CA',
    postalCode: '94000',
    ssnLast4: '1234',
  }
  assert.deepEqual(validateStep(identity, full), {})
  assert.equal(isStepComplete(identity, full), true)
})

test('custom validators fire: under-18 DOB and bad SSN-last4', () => {
  const identity = stepById(EXCHANGE_FULL, 'identity')!
  const minor = validateStep(identity, {
    legalFirstName: 'Kid',
    legalLastName: 'Doe',
    dob: '2020-01-01',
    country: 'US',
    addressLine1: 'x',
    city: 'x',
    state: 'x',
    postalCode: 'x',
    ssnLast4: '1234',
  })
  assert.match(minor.dob!, /at least 18/)

  const badSsn = validateStep(identity, {
    legalFirstName: 'Ada',
    legalLastName: 'Lovelace',
    dob: '1990-01-01',
    country: 'US',
    addressLine1: 'x',
    city: 'x',
    state: 'x',
    postalCode: 'x',
    ssnLast4: '12',
  })
  assert.match(badSsn.ssnLast4!, /last 4 digits/)
})

test('non-form steps gate on their synthetic completion key', () => {
  const account = stepById(EXCHANGE_FULL, 'account-type')!
  const doc = stepById(EXCHANGE_FULL, 'document')!
  // account-type incomplete until chosen.
  assert.ok(!isStepComplete(account, {}))
  assert.ok(isStepComplete(account, { [stepCompletionKey(account)]: true }))
  // document incomplete until IDV records a pass.
  assert.ok(!isStepComplete(doc, {}))
  assert.ok(isStepComplete(doc, { [stepCompletionKey(doc)]: true }))
})

// ── Machine: resume point / completeness ────────────────────────────

test('firstIncompleteStep is the resume point and null when finished', () => {
  // Fresh individual applicant: first incomplete is the very first step.
  const fresh: FormData = { accountType: 'individual' }
  // account-type itself is not yet marked complete.
  assert.equal(firstIncompleteStep(EXCHANGE_FULL, fresh), 'account-type')

  // A fully-answered individual flow → complete.
  const done: FormData = {
    accountType: 'individual',
    [stepCompletionKey(stepById(EXCHANGE_FULL, 'account-type')!)]: true,
    legalFirstName: 'Ada',
    legalLastName: 'Lovelace',
    dob: '1990-01-01',
    country: 'US',
    addressLine1: '1 Analytical Way',
    city: 'London',
    state: 'CA',
    postalCode: '94000',
    ssnLast4: '1234',
    [stepCompletionKey(stepById(EXCHANGE_FULL, 'document')!)]: true,
    // accreditation: not attested → not required, so the step is complete.
    [stepCompletionKey(stepById(EXCHANGE_FULL, 'screening')!)]: true,
  }
  assert.equal(firstIncompleteStep(EXCHANGE_FULL, done), null)
  assert.equal(isFlowComplete(EXCHANGE_FULL, done), true)
})

test('lite flow: a display name completes the whole flow', () => {
  assert.equal(firstStepId(LITE, {}), 'profile')
  assert.equal(firstIncompleteStep(LITE, {}), 'profile')
  assert.equal(isFlowComplete(LITE, { displayName: 'Satoshi' }), true)
})

// ── Screening ───────────────────────────────────────────────────────

test('screening: allow for US, block for sanctioned, escalate for unknown', () => {
  assert.equal(screenCountry('US').action, 'allow')
  assert.equal(screenCountry('US').blocking, false)

  const kp = screenCountry('KP')
  assert.equal(kp.action, 'block')
  assert.equal(kp.blocking, true)
  assert.equal(kp.tone, 'error')

  // Unknown / OTHER defaults to escalate (more scrutiny, never less).
  assert.equal(screenCountry('OTHER').action, 'escalate')
  assert.equal(screenCountry('ZZ').action, 'escalate')
  assert.equal(screenCountry(undefined).action, 'escalate')
})

// ── Service: fake-fetch harness ─────────────────────────────────────

interface Recorded {
  url: string
  method: string
  body?: string
  headers: Record<string, string>
}

function harness(script: (rec: Recorded) => { status?: number; json: unknown }) {
  const calls: Recorded[] = []
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {}
    const h = init?.headers as Record<string, string> | undefined
    if (h) for (const k of Object.keys(h)) headers[k] = h[k]!
    const rec: Recorded = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : undefined,
      headers,
    }
    calls.push(rec)
    const { status = 200, json } = script(rec)
    return new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as unknown as typeof fetch

  const service = createOnboardingService({
    iamUrl: 'https://lux.id',
    orgId: 'lux',
    getAccessToken: () => 'tok-123',
    fetchImpl,
  })
  return { service, calls }
}

test('loadDraft returns null when the user has no saved application', async () => {
  const { service } = harness(() => ({
    json: { status: 'ok', data: { owner: 'lux', name: 'ada', properties: {} } },
  }))
  assert.equal(await service.loadDraft(), null)
})

test('saveDraft resolves the user then writes a scoped properties column', async () => {
  const draftData: FormData = { accountType: 'individual', legalFirstName: 'Ada' }
  const { service, calls } = harness((rec) => {
    if (rec.url.includes('get-account')) {
      return { json: { status: 'ok', data: { owner: 'lux', name: 'ada', properties: { keep: 'me' } } } }
    }
    return { json: { status: 'ok' } }
  })
  const res = await service.saveDraft({ flow: 'exchange-full', data: draftData })
  assert.equal(res.ok, true)
  // 1) get-account, 2) update-user scoped to properties.
  assert.match(calls[0]!.url, /get-account$/)
  const upd = calls[1]!
  assert.ok(upd.url.includes('/v1/iam/update-user'))
  assert.ok(upd.url.includes('id=lux%2Fada') || upd.url.includes('id=lux/ada'))
  assert.ok(upd.url.includes('columns=properties'))
  assert.equal(upd.headers.Authorization, 'Bearer tok-123')
  const sent = JSON.parse(upd.body!)
  // unrelated properties survive, the draft is serialized under luxOnboarding.
  assert.equal(sent.properties.keep, 'me')
  const persisted = JSON.parse(sent.properties.luxOnboarding)
  assert.equal(persisted.flow, 'exchange-full')
  assert.equal(persisted.submitted, false)
  assert.deepEqual(persisted.data, draftData)
})

test('loadDraft round-trips a previously saved draft', async () => {
  const stored = JSON.stringify({
    flow: 'exchange-full',
    data: { accountType: 'corporate' },
    submitted: false,
    updatedAt: 1700000000000,
  })
  const { service } = harness(() => ({
    json: { status: 'ok', data: { owner: 'lux', name: 'ada', properties: { luxOnboarding: stored } } },
  }))
  const draft = await service.loadDraft()
  assert.ok(draft)
  assert.equal(draft!.flow, 'exchange-full')
  assert.equal(draft!.data.accountType, 'corporate')
})

test('submit marks the draft submitted=true', async () => {
  const { service, calls } = harness((rec) => {
    if (rec.url.includes('get-account')) {
      return { json: { status: 'ok', data: { owner: 'lux', name: 'ada', properties: {} } } }
    }
    return { json: { status: 'ok' } }
  })
  const res = await service.submit({ flow: 'lite', data: { displayName: 'Satoshi' } })
  assert.equal(res.ok, true)
  const sent = JSON.parse(calls[1]!.body!)
  assert.equal(JSON.parse(sent.properties.luxOnboarding).submitted, true)
})

test('saveDraft fails closed when there is no signed-in user', async () => {
  const { service } = harness(() => ({ status: 401, json: { status: 'error', msg: 'no session' } }))
  assert.deepEqual(await service.saveDraft({ flow: 'lite', data: {} }), {
    ok: false,
    error: 'not signed in',
  })
})
