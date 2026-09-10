export function decidirConferencia({ temUrl, fork, autor }: { temUrl: boolean; fork: boolean; autor: string }): 'conferir' | 'pular' | 'falhar' {
  if (temUrl) return 'conferir'
  if (fork || autor === 'dependabot[bot]') return 'pular'
  return 'falhar'
}
