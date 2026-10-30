/**
 * Syndicate settings form: shape and checks, shared by the Settings page, the new-syndicate
 * page and their tests. Money is whole pounds. The server checks everything again; these
 * checks are for the captain.
 */

import { seasonDates, speciesById } from './seasonDates.js'

export interface SyndicateSettings {
  id: string
  name: string
  seasonStart: string
  seasonEnd: string
  subscriptionAmount: number
  subscriptionType: 'ANNUAL' | 'PER_SHOOT' | 'HYBRID'
  defaultBeaterRate: number
  pegRotationRule: 'FAIR_ROTATION' | 'RANDOM' | 'MANUAL'
  /** Clauses added under the standard guest acknowledgement, or null. */
  waiverExtra?: string | null
}

export interface SettingsForm {
  name: string
  seasonStart: string
  seasonEnd: string
  subscriptionAmount: string
  subscriptionType: SyndicateSettings['subscriptionType']
  defaultBeaterRate: string
  pegRotationRule: 'FAIR_ROTATION' | 'RANDOM'
  waiverExtra: string
}

export const toForm = (s: SyndicateSettings): SettingsForm => ({
  name: s.name,
  seasonStart: s.seasonStart.slice(0, 10),
  seasonEnd: s.seasonEnd.slice(0, 10),
  subscriptionAmount: String(s.subscriptionAmount),
  subscriptionType: s.subscriptionType,
  defaultBeaterRate: String(s.defaultBeaterRate),
  pegRotationRule: s.pegRotationRule === 'RANDOM' ? 'RANDOM' : 'FAIR_ROTATION',
  waiverExtra: s.waiverExtra ?? '',
})

/** Problems with the form, by field. Empty when it can be saved. */
export function validateSettings(form: SettingsForm): Partial<Record<keyof SettingsForm, string>> {
  const problems: Partial<Record<keyof SettingsForm, string>> = {}
  if (!form.name.trim()) problems.name = 'Give your syndicate a name.'
  if (form.name.trim().length > 100) problems.name = 'Keep the name to 100 characters.'
  if (!form.seasonStart) problems.seasonStart = 'Choose the first day of the season.'
  if (!form.seasonEnd) problems.seasonEnd = 'Choose the last day of the season.'
  if (form.seasonStart && form.seasonEnd && form.seasonEnd <= form.seasonStart) problems.seasonEnd = 'The season must end after it starts.'
  const whole = (v: string, max: number) => /^\d+$/.test(v.trim()) && Number(v) <= max
  if (!whole(form.subscriptionAmount, 1_000_000)) problems.subscriptionAmount = 'Whole pounds, for example 800.'
  if (!whole(form.defaultBeaterRate, 1000)) problems.defaultBeaterRate = 'Whole pounds from £0 to £1,000.'
  if (form.waiverExtra.trim().length > 2000) problems.waiverExtra = 'Keep your own clauses to 2,000 characters.'
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
    waiverExtra: form.waiverExtra.trim() || null,
  }
  const old: Record<string, unknown> = {
    name: before.name.trim(),
    seasonStart: before.seasonStart,
    seasonEnd: before.seasonEnd,
    subscriptionAmount: Number(before.subscriptionAmount),
    subscriptionType: before.subscriptionType,
    defaultBeaterRate: Number(before.defaultBeaterRate),
    pegRotationRule: before.pegRotationRule,
    waiverExtra: before.waiverExtra.trim() || null,
  }
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== old[key]))
}

/** "2026-10-01": a UTC date as the form's date fields hold it. */
const isoDay = (date: Date) => date.toISOString().slice(0, 10)

/**
 * The pheasant season a new syndicate is most likely setting up for, from the UK date today:
 * the one under way, or the next one once the last has closed. The captain can change both dates.
 */
export function suggestedSeason(today: string): { seasonStart: string; seasonEnd: string } {
  const pheasant = speciesById('pheasant').seasons.englandWales!
  const year = Number(today.slice(0, 4))
  const lastYears = seasonDates(pheasant, year - 1)
  const { opens, closes } = today <= isoDay(lastYears.closes) ? lastYears : seasonDates(pheasant, year)
  return { seasonStart: isoDay(opens), seasonEnd: isoDay(closes) }
}

/** A new syndicate's form: the likely season, the usual defaults, no name. */
export function newSyndicateForm(today: string): SettingsForm {
  return {
    name: '',
    ...suggestedSeason(today),
    subscriptionAmount: '0',
    subscriptionType: 'ANNUAL',
    defaultBeaterRate: '40',
    pegRotationRule: 'FAIR_ROTATION',
    waiverExtra: '',
  }
}

/** What to send to create a syndicate from the form. */
export function newSyndicatePayload(form: SettingsForm) {
  return {
    name: form.name.trim(),
    seasonStart: form.seasonStart,
    seasonEnd: form.seasonEnd,
    subscriptionAmount: Number(form.subscriptionAmount),
    subscriptionType: form.subscriptionType,
    defaultBeaterRate: Number(form.defaultBeaterRate),
    pegRotationRule: form.pegRotationRule,
  }
}
