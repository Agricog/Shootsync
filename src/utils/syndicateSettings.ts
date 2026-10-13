/**
 * Syndicate settings form: shape and checks, shared by the Settings page and its tests.
 * Money is whole pounds. The server checks everything again; these checks are for the captain.
 */

export interface SyndicateSettings {
  id: string
  name: string
  seasonStart: string
  seasonEnd: string
  subscriptionAmount: number
  subscriptionType: 'ANNUAL' | 'PER_SHOOT' | 'HYBRID'
  defaultBeaterRate: number
  pegRotationRule: 'FAIR_ROTATION' | 'RANDOM' | 'MANUAL'
}

export interface SettingsForm {
  name: string
  seasonStart: string
  seasonEnd: string
  subscriptionAmount: string
  subscriptionType: SyndicateSettings['subscriptionType']
  defaultBeaterRate: string
  pegRotationRule: 'FAIR_ROTATION' | 'RANDOM'
}

export const toForm = (s: SyndicateSettings): SettingsForm => ({
  name: s.name,
  seasonStart: s.seasonStart.slice(0, 10),
  seasonEnd: s.seasonEnd.slice(0, 10),
  subscriptionAmount: String(s.subscriptionAmount),
  subscriptionType: s.subscriptionType,
  defaultBeaterRate: String(s.defaultBeaterRate),
  pegRotationRule: s.pegRotationRule === 'RANDOM' ? 'RANDOM' : 'FAIR_ROTATION',
})

/** Problems with the form, by field. Empty when it can be saved. */
export function validateSettings(form: SettingsForm): Partial<Record<keyof SettingsForm, string>> {
  const problems: Partial<Record<keyof SettingsForm, string>> = {}
  if (!form.name.trim()) problems.name = 'Give your syndicate a name.'
  if (form.name.trim().length > 100) problems.name = 'Keep the name to 100 characters.'
  if (!form.seasonStart) problems.seasonStart = 'Choose the first day of the season.'
  if (!form.seasonEnd) problems.seasonEnd = 'Choose the last day of the season.'
  if (form.seasonStart && form.seasonEnd && form.seasonEnd < form.seasonStart) problems.seasonEnd = 'The season must end after it starts.'
  const whole = (v: string, max: number) => /^\d+$/.test(v.trim()) && Number(v) <= max
  if (!whole(form.subscriptionAmount, 1_000_000)) problems.subscriptionAmount = 'Whole pounds, for example 800.'
  if (!whole(form.defaultBeaterRate, 1000)) problems.defaultBeaterRate = 'Whole pounds from £0 to £1,000.'
  return problems
}


/**
 * What to send: only the fields that changed. A syndicate set to "manual" pegs (from before this
 * page could show it) keeps that setting unless the captain picks another one here.
 */
export function settingsPayload(form: SettingsForm, saved: SyndicateSettings): Record<string, unknown> {
  const before = toForm(saved)
  const next: Record<string, unknown> = {
    name: form.name.trim(),
    seasonStart: form.seasonStart,
    seasonEnd: form.seasonEnd,
    subscriptionAmount: Number(form.subscriptionAmount),
    subscriptionType: form.subscriptionType,
    defaultBeaterRate: Number(form.defaultBeaterRate),
    pegRotationRule: form.pegRotationRule,
  }
  const old: Record<string, unknown> = {
    name: before.name.trim(),
    seasonStart: before.seasonStart,
    seasonEnd: before.seasonEnd,
    subscriptionAmount: Number(before.subscriptionAmount),
    subscriptionType: before.subscriptionType,
    defaultBeaterRate: Number(before.defaultBeaterRate),
    pegRotationRule: before.pegRotationRule,
  }
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== old[key]))
}
