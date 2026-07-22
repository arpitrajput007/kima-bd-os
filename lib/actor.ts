export type Actor = 'me' | 'pluto'

/** Who's using the app right now, based on which passcode they logged in with. */
export function getActor(): Actor {
  if (typeof document === 'undefined') return 'me'
  const match = document.cookie.match(/(?:^|;\s*)kima_bd_actor=([^;]+)/)
  return match?.[1] === 'pluto' ? 'pluto' : 'me'
}

export const ACTOR_LABEL: Record<Actor, string> = {
  me: 'You',
  pluto: 'Pluto',
}
