import { credits } from '../lib/library-photo-credits.ts'

export function PhotoCredit({ source }: { source: string }) {
  const credit = credits[source.slice('/library/'.length)]
  if (!credit) return null
  return <p className="mt-2 text-xs text-muted">
    <a className="underline" href={credit.source} target="_blank" rel="noreferrer">Foto de {credit.author}</a>
    {' · '}
    {credit.licenseUrl
      ? <a className="underline" href={credit.licenseUrl} target="_blank" rel="noreferrer">{credit.license}</a>
      : credit.license}
  </p>
}
