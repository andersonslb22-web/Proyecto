import type { ValidationIssue } from './types'

export function issueLocation(issue: ValidationIssue, text: string): string {
  const teamPath = issue.path.match(/^\$\.match\.teams\[(\d+)\](?:\.|$)/)
  if (teamPath) {
    const index = Number(teamPath[1])
    try {
      const parsed: unknown = JSON.parse(text)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const match = (parsed as Record<string, unknown>).match
        if (typeof match === 'object' && match !== null && !Array.isArray(match)) {
          const teams = (match as Record<string, unknown>).teams
          if (Array.isArray(teams)) {
            const team = teams[index]
            if (typeof team === 'object' && team !== null && !Array.isArray(team)) {
              const side = (team as Record<string, unknown>).side
              if (side === 'home') return 'Equipo local'
              if (side === 'away') return 'Equipo visitante'
            }
          }
        }
      }
    } catch {
      return `Equipo ${index + 1}`
    }
    return `Equipo ${index + 1}`
  }
  if (issue.path.startsWith('$.match')) return 'Partido'
  return 'Entrada'
}