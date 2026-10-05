/**
 * Rollout switch for Projects. Off unless NEXT_PUBLIC_PROJECTS_ENABLED=true, so a
 * build that ships before the Projects backend is deployed (or before the feature
 * is announced) shows no Projects UI and makes no Projects requests.
 *
 * Deploy order when turning it on: backend (amplify-assistants, then
 * amplify-lambda-js — see docs/PROJECTS_ROLLOUT.md), then set the variable and
 * rebuild the frontend. NEXT_PUBLIC_* values are inlined at build time.
 */
export const PROJECTS_ENABLED = process.env.NEXT_PUBLIC_PROJECTS_ENABLED === 'true';
