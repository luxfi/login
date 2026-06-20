/**
 * Onboarding unit tests — run with the Node built-in test runner and native
 * TypeScript stripping (no test-framework dependency):
 *
 *   pnpm --filter @luxfi/id-onboarding test
 *
 * (which registers the extensionless-`.ts` resolver hook, then runs
 * `node --test --experimental-strip-types`). Covers the React-free surface:
 * the flow machine (reveals, validation, resume point), the country-risk
 * screening, and the service's request shaping + IAM response translation
 * (with an injected fake fetch).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXCHANGE_FULL, LITE, flowById } from './domain/flows'
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
} from './domain/machine'
import { screenCountry } from './domain/screening'
import { createOnboardingService } from './service/onboarding'
import type { FormData } from './domain/types'

// ── Flow registry ───────────────────────────────────────────────────

test('flowById defaults to exchange-full, resolves lite explicitly', () => {
  assert.equal(flowById(undefined).id, 'exchange-full')
  assert.equal(flowById('exchange-full').id, 'exchange-full')
  assert.equal(flowById('lite').id, 'lite')
  assert.equal(flowById('garbage').id, 'exchange-full')
})

// ── Machine: enabledWhen reveals (aggressive gating) ─────────────────

test('individual default path is short — no SSN/document, screening, or entity steps', () => {
  // No funding choice yet: every heavy compliance step stays hidden, so the
  // applicant reaches review in a handful of single-question screens.
  const data: FormData = { accountType: 'individual' }
  const ids = activeSteps(EXCHANGE_FULL, data).map((s) => s.id)
  assert.deepEqual(ids, ['account-type', 'name', 'birthday', 'address', 'funding', 'review'])
})

test('a $5k+ deposit reveals the individual document (IDV) step; smaller deposits do not', () => {
  const base: FormData = { accountType: 'individual', country: 'US' }
  const has = (d: FormData) => activeSteps(EXCHANGE_FULL, d).some((s) => s.id === 'document')
  assert.ok(!has({ ...base, fundingPlan: 'later' }))
  assert.ok(!has({ ...base, fundingPlan: 'standard' }))
  assert.ok(has({ ...base, fundingPlan: 'large' }))
})

test('non-US individual reveals the screening step; US does not', () => {
  const has = (d: FormData) => activeSteps(EXCHANGE_FULL, d).some((s) => s.id === 'screening')
  assert.ok(!has({ accountType: 'individual', country: 'US' }))
  assert.ok(has({ accountType: 'individual', country: 'GB' }))
})

test('corporate path reveals entity + entity-document + accreditation, hides the individual document', () => {
  const data: FormData = { accountType: 'corporate', fundingPlan: 'large' }
  const ids = activeSteps(EXCHANGE_FULL, data).map((s) => s.id)
  assert.ok(ids.includes('entity'))
  assert.ok(ids.includes('entity-document'))
  assert.ok(ids.includes('accreditation'))
  assert.ok(!ids.includes('document')) // the individual doc step is hidden
})

test('nextStepId / prevStepId skip disabled steps in both directions', () => {
  const data: FormData = { accountType: 'individual' }
  // account-type → name (entity is skipped for individuals)
  assert.equal(nextStepId(EXCHANGE_FULL, data, 'account-type'), 'name')
  assert.equal(prevStepId(EXCHANGE_FULL, data, 'name'), 'account-type')
  // address → funding (entity skipped going forward too)
  assert.equal(nextStepId(EXCHANGE_FULL, data, 'address'), 'funding')
  // funding → review on the short path (document hidden without a $5k+ deposit)
  assert.equal(nextStepId(EXCHANGE_FULL, data, 'funding'), 'review')
  // funding → document once a $5k+ deposit is chosen
  assert.equal(
    nextStepId(EXCHANGE_FULL, { ...data, country: 'US', fundingPlan: 'large' }, 'funding'),
    'document',
  )
})

test('firstStepId is account-type; review is the last active step', () => {
  const data: FormData = { accountType: 'individual' }
  assert.equal(firstStepId(EXCHANGE_FULL, data), 'account-type')
  assert.equal(isLastStep(EXCHANGE_FULL, data, 'review'), true)
  assert.equal(isLastStep(EXCHANGE_FULL, data, 'name'), false)
  assert.equal(nextStepId(EXCHANGE_FULL, data, 'review'), null)
})

// ── Machine: visibleWhen field reveals ──────────────────────────────

test('funding reveals SSN-last4 for a US funder, tax ID for non-US, neither for "fund later"', () => {
  const funding = stepById(EXCHANGE_FULL, 'funding')!
  const us = visibleFields(funding, { country: 'US', fundingPlan: 'standard' }).map((f) => f.name)
  assert.ok(us.includes('ssnLast4'))
  assert.ok(!us.includes('taxId'))

  const intl = visibleFields(funding, { country: 'GB', fundingPlan: 'standard' }).map((f) => f.name)
  assert.ok(intl.includes('taxId'))
  assert.ok(!intl.includes('ssnLast4'))

  // Fund-later collects no tax identity at all.
  const later = visibleFields(funding, { country: 'US', fundingPlan: 'later' }).map((f) => f.name)
  assert.ok(!later.includes('ssnLast4'))
  assert.ok(!later.includes('taxId'))
})

// ── Machine: validation ─────────────────────────────────────────────

test('a required field blocks until filled; hidden fields are not required', () => {
  const name = stepById(EXCHANGE_FULL, 'name')!
  const empty = validateStep(name, {})
  assert.ok(empty.legalFirstName)
  assert.ok(empty.legalLastName)
  assert.deepEqual(validateStep(name, { legalFirstName: 'Ada', legalLastName: 'Lovelace' }), {})

  // Funding: the plan is required; SSN stays optional until they choose to fund.
  const funding = stepById(EXCHANGE_FULL, 'funding')!
  const noPlan = validateStep(funding, { country: 'US' })
  assert.ok(noPlan.fundingPlan)
  assert.ok(!('ssnLast4' in noPlan)) // hidden until funding → not required
  assert.deepEqual(validateStep(funding, { country: 'US', fundingPlan: 'later' }), {})
  // A US funder must supply SSN-last4.
  assert.ok(validateStep(funding, { country: 'US', fundingPlan: 'standard' }).ssnLast4)
})

test('custom validators fire: under-18 DOB and bad SSN-last4', () => {
  const dob = stepById(EXCHANGE_FULL, 'birthday')!
  assert.match(validateStep(dob, { dob: '2020-01-01' }).dob!, /at least 18/)
  assert.deepEqual(validateStep(dob, { dob: '1990-01-01' }), {})

  const funding = stepById(EXCHANGE_FULL, 'funding')!
  const badSsn = validateStep(funding, { country: 'US', fundingPlan: 'standard', ssnLast4: '12' })
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
  assert.equal(firstIncompleteStep(EXCHANGE_FULL, fresh), 'account-type')

  // A fully-answered "explore first" individual → complete on the short path:
  // no SSN, no document IDV, no screening.
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
    fundingPlan: 'later',
  }
  assert.equal(firstIncompleteStep(EXCHANGE_FULL, done), null)
  assert.equal(isFlowComplete(EXCHANGE_FULL, done), true)
})

test('a $5k+ individual must clear the document IDV step to finish', () => {
  const base: FormData = {
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
    fundingPlan: 'large',
    ssnLast4: '1234',
  }
  // document still pending → resume lands on it.
  assert.equal(firstIncompleteStep(EXCHANGE_FULL, base), 'document')
  // once IDV passes, the flow completes.
  const passed: FormData = { ...base, [stepCompletionKey(stepById(EXCHANGE_FULL, 'document')!)]: true }
  assert.equal(isFlowComplete(EXCHANGE_FULL, passed), true)
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
