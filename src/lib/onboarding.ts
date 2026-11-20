type SetupKind = 'create' | 'join'
type SetupStatus = SetupKind | 'completed' | 'skipped'

const sessionPreferences = new Map<string, string>()

function read(key: string) {
  try { return sessionPreferences.get(key) ?? window.localStorage.getItem(key) }
  catch { return sessionPreferences.get(key) }
}

function save(key: string, value: string) {
  sessionPreferences.set(key, value)
  try { window.localStorage.setItem(key, value) }
  catch { /* La decisión se recuerda durante la sesión si el navegador bloquea el almacenamiento. */ }
}

const guideKey = (userId: string) => `en-casa:guide:v1:${userId}`
const setupKey = (userId: string, familyId: string) => `en-casa:catalog-setup:v1:${userId}:${familyId}`

export function shouldShowGuide(userId: string) {
  return !read(guideKey(userId))
}

export function finishGuide(userId: string, outcome: 'completed' | 'skipped') {
  save(guideKey(userId), outcome)
}

export function getCatalogSetup(userId: string, familyId: string): SetupKind | null {
  const status = read(setupKey(userId, familyId))
  return status === 'create' || status === 'join' ? status : null
}

export function saveCatalogSetup(userId: string, familyId: string, status: SetupStatus) {
  const key = setupKey(userId, familyId)
  if ((status === 'create' || status === 'join') && read(key)) return
  save(key, status)
}
