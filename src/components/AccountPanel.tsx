import { useEffect, useRef, useState } from 'react'
import type { FamilyContext } from '../types.ts'
import type { FormEvent } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.ts'
import { saveCatalogSetup } from '../lib/onboarding.ts'
import { unregisterPushOnSignOut } from '../lib/web-push.ts'
import { ShoppingPushSettings } from './ShoppingPushSettings.tsx'

export function AccountPanel({ onFamilyChange, onResolvingChange }: { onResolvingChange: (resolving: boolean) => void; onFamilyChange: (family: FamilyContext | null) => void }) {
  return <section className="surface mb-7 p-5 sm:p-6" aria-labelledby="account-title">
    <h2 id="account-title" className="text-xl font-bold">Tu cuenta familiar</h2>
    {supabase ? <Account client={supabase} onFamilyChange={onFamilyChange} onResolvingChange={onResolvingChange} /> : <p className="mt-2 text-sm text-muted">La lista local ya está disponible. Las cuentas estarán disponibles cuando se complete la conexión con Supabase.</p>}
  </section>
}

function Account({ client, onFamilyChange, onResolvingChange }: { client: SupabaseClient; onResolvingChange: (resolving: boolean) => void; onFamilyChange: (family: FamilyContext | null) => void }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [signup, setSignup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    let receivedEvent = false
    let previousUser: string | null = null
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      receivedEvent = true
      if (active) {
        if (previousUser !== (next?.user.id ?? null)) { onResolvingChange(!!next); onFamilyChange(null) }
        if (!next) onResolvingChange(false)
        previousUser = next?.user.id ?? null
        setSession(next); setLoading(false)
      }
    })
    void client.auth.getSession().then(({ data: current, error: failure }) => {
      if (!active || receivedEvent) return
      if (failure) setError('No pudimos recuperar tu sesión. Intentá ingresar nuevamente.')
      if (!current.session) onResolvingChange(false)
      previousUser = current.session?.user.id ?? null
      setSession(current.session); setLoading(false)
    }).catch(() => { if (active) { setError('No pudimos conectar con el servicio de cuentas.'); setLoading(false); onResolvingChange(false) } })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [client, onFamilyChange, onResolvingChange])

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const credentials = { email: String(values.get('email')).trim(), password: String(values.get('password')) }
    setBusy(true); setError(''); setMessage('')
    try {
      const result = signup
        ? await client.auth.signUp({ ...credentials, options: { emailRedirectTo: window.location.origin } })
        : await client.auth.signInWithPassword(credentials)
      if (result.error) { setError('No se pudo completar el acceso. Revisá tus datos, la confirmación del correo o intentá más tarde.'); return }
      form.reset()
      if (signup) setMessage('Si el registro requiere confirmación, revisá tu correo antes de ingresar.')
    } catch { setError('No pudimos conectar. Revisá tu conexión e intentá de nuevo.') }
    finally { setBusy(false) }
  }

  async function signOut() {
    setBusy(true); setError(''); setMessage('')
    try {
      await unregisterPushOnSignOut(client)
      const result = await client.auth.signOut({ scope: 'local' })
      if (result.error) setError('No se pudo cerrar la sesión. Intentá de nuevo.')
      else { setSession(null); onFamilyChange(null) }
    } catch { setError('No se pudo cerrar la sesión. Revisá la conexión.') }
    finally { setBusy(false) }
  }

  return <>
    <p className="mt-2 text-sm text-muted">Al ingresar con una familia se muestra su lista compartida. Sin sesión se usa una lista local independiente.</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm text-forest">{message}</p>}
    {loading ? <p className="mt-4" role="status">Recuperando sesión…</p> : session ? <>
      <div className="mt-4 flex flex-wrap items-center gap-3"><p className="min-w-0 break-all text-sm">{session.user.email}</p><button type="button" className="button-secondary" disabled={busy} onClick={signOut}>Cerrar sesión en este navegador</button></div>
      <FamilyPanel key={session.user.id} client={client} userId={session.user.id} onFamilyChange={onFamilyChange} onResolvingChange={onResolvingChange} />
    </> : <>
      <div className="mt-4 flex flex-wrap gap-2"><button className="button-secondary" type="button" disabled={busy} aria-pressed={!signup} onClick={() => { setSignup(false); setError(''); setMessage('') }}>Ingresar</button><button className="button-secondary" type="button" disabled={busy} aria-pressed={signup} onClick={() => { setSignup(true); setError(''); setMessage('') }}>Crear cuenta</button></div>
      <form key={String(signup)} onSubmit={authenticate} className="mt-4 max-w-md space-y-4">
        <label className="field-label" htmlFor="account-email">Correo electrónico</label><input className="field" id="account-email" name="email" type="email" autoComplete="email" required maxLength={254} />
        <label className="field-label" htmlFor="account-password">Contraseña</label><input className="field" id="account-password" name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : undefined} maxLength={128} />
        {signup && <p className="text-xs text-muted">Usá al menos 8 caracteres y confirmá el correo si se solicita.</p>}
        <button className="button-primary w-full" disabled={busy}>{busy ? 'Procesando…' : signup ? 'Crear cuenta' : 'Ingresar'}</button>
      </form>
    </>}
  </>
}

interface Family { id: string; name: string; owner_id: string }
interface Member { user_id: string; display_name: string }

function FamilyPanel({ client, userId, onFamilyChange, onResolvingChange }: { client: SupabaseClient; userId: string; onResolvingChange: (resolving: boolean) => void; onFamilyChange: (family: FamilyContext | null) => void }) {
  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [invite, setInvite] = useState('')
  const [inviteExpires, setInviteExpires] = useState('')
  const [refresh, setRefresh] = useState(0)
  const joining = useRef(false)
  useEffect(() => {
    let active = true
    let inFlight = false
    async function load() {
      if (inFlight || joining.current) return
      inFlight = true
      try {
        const result = await client.from('families').select('id,name,owner_id').abortSignal(AbortSignal.timeout(12000)).maybeSingle()
        if (result.error) throw result.error
        let roster: Member[] = []
        if (result.data) {
          const response = await client.from('family_members').select('user_id,display_name').eq('family_id', result.data.id).order('joined_at').abortSignal(AbortSignal.timeout(12000))
          if (response.error) throw response.error
          roster = response.data
        }
        let invitation: { token: string; expiresAt: string } | null = null
        if (result.data?.owner_id === userId) {
          const response = await client.rpc('get_family_invite').abortSignal(AbortSignal.timeout(12000))
          if (response.error?.code === 'PGRST202') throw new Error('Falta aplicar la migración 0005 de administración familiar en Supabase.')
          if (response.error) throw response.error
          invitation = response.data
        }
        if (active && !joining.current) {
          setInvite(invitation?.token ?? ''); setInviteExpires(invitation?.expiresAt ?? '')
          setError('')
          onResolvingChange(false)
          setFamily(result.data); setMembers(roster); setLoaded(true)
          onFamilyChange(result.data ? { id: result.data.id, name: result.data.name, userId, ownerId: result.data.owner_id } : null)
        }
      } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : 'No pudimos cargar tu familia. Revisá la conexión o la configuración de la base de datos.') }
      finally { inFlight = false }
    }
    void load()
    const update = () => { if (!document.hidden) void load() }
    const timer = window.setInterval(update, 5000)
    window.addEventListener('focus', update)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [client, refresh, onFamilyChange, onResolvingChange, userId])

  async function action(event: FormEvent<HTMLFormElement>, kind: 'create' | 'join') {
    event.preventDefault()
    if (joining.current) return
    const values = new FormData(event.currentTarget)
    const display = String(values.get('display_name')).trim()
    joining.current = true
    setBusy(true); setError('')
    try {
      const result = kind === 'create'
        ? await client.rpc('create_family', { p_name: String(values.get('family_name')).trim(), p_display_name: display })
        : await client.rpc('join_family', { p_token: String(values.get('token')).trim(), p_display_name: display })
      if (result.error) { setError('No se pudo completar la operación. Actualizá antes de reintentar; la invitación puede ser inválida, usada o estar vencida.'); return }
      if (typeof result.data === 'string') saveCatalogSetup(userId, result.data, kind)
      setLoaded(false); setRefresh(value => value + 1)
    } catch { setError('No pudimos conectar. Actualizá antes de repetir la operación.') }
    finally { joining.current = false; setBusy(false) }
  }

  async function generateInvite() {
    setBusy(true); setError(''); setInvite('')
    try {
      const result = await client.rpc('create_family_invite')
      if (result.error || typeof result.data !== 'string') { setError('No se pudo generar la invitación. Solo la persona responsable puede hacerlo.'); return }
      setInvite(result.data); setRefresh(value => value + 1)
    } catch { setError('No pudimos conectar para generar la invitación.') }
    finally { setBusy(false) }
  }

  async function manage(action: 'remove' | 'leave' | 'revoke_invite', target?: Member) {
    const prompt = action === 'remove' ? `¿Quitar a ${target?.display_name}? Perderá acceso y se invalidará la invitación activa. Su cuenta y compras se conservan.` : action === 'leave' ? '¿Abandonar la familia? Perderás acceso a sus datos; tu cuenta y compras anteriores se conservan.' : '¿Revocar la invitación activa?'
    if (!window.confirm(prompt) || busy) return
    setBusy(true); setError('')
    try {
      const response = await client.rpc('manage_family', { p_action: action, p_user_id: target?.user_id ?? null })
      if (response.error) { setError('No se pudo realizar la operación. Verificá tus permisos y actualizá la familia.'); return }
      if (action === 'leave') { onFamilyChange(null); setFamily(null); setMembers([]) }
      setRefresh(value => value + 1)
    } catch { setError('No pudimos conectar. Actualizá antes de repetir la operación.') }
    finally { setBusy(false) }
  }
  return <div className="mt-5">
    {error && <p role="alert" className="mb-3 text-sm text-red-800">{error}</p>}
    <button className="button-secondary mb-4" type="button" disabled={busy} onClick={() => { setError(''); setRefresh(value => value + 1) }}>Actualizar familia</button>
    {!loaded ? <p role="status" className="text-sm text-muted">La familia todavía no está disponible.</p> : family ? <>
      <h3 className="break-words text-lg font-bold">{family.name}</h3>
      <ul className="mt-3 space-y-2" aria-label="Integrantes de la familia">{members.map(member => <li key={member.user_id} className="break-words text-sm">{member.display_name}{member.user_id === family.owner_id ? ' · Responsable' : ''}{member.user_id === userId ? ' · Vos' : ''}{family.owner_id === userId && member.user_id !== userId && <button className="button-secondary mt-2" disabled={busy} onClick={() => void manage('remove', member)}>Quitar integrante</button>}</li>)}</ul>
      {family.owner_id === userId && <><button className="button-primary mt-4" disabled={busy} onClick={generateInvite}>Generar invitación</button><p className="mt-2 text-xs text-muted">Se usa una vez y vence en 7 días. Generar otra invalida la anterior. Compartila solo con la persona que quieras incorporar.</p></>}
      {family.owner_id !== userId && <button className="button-secondary mt-4" disabled={busy} onClick={() => void manage('leave')}>Abandonar familia</button>}
      {invite && <div className="mt-3"><label className="field-label" htmlFor="family-invite">Código de invitación</label><input className="field" id="family-invite" readOnly value={invite} onFocus={event => event.target.select()} /><p className="mt-2 text-xs text-muted">{inviteExpires ? `Vence: ${new Date(inviteExpires).toLocaleString('es-AR')}` : ''}</p><button className="button-secondary mt-2" disabled={busy} onClick={() => void manage('revoke_invite')}>Revocar invitación</button></div>}
      <ShoppingPushSettings key={family.id} client={client} />
    </> : <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={event => action(event, 'create')} className="space-y-3"><h3 className="font-bold">Crear una familia</h3><label className="field-label" htmlFor="create-display">Tu nombre</label><input className="field" id="create-display" name="display_name" required maxLength={60} /><label className="field-label" htmlFor="family-name">Nombre de la familia</label><input className="field" id="family-name" name="family_name" required maxLength={80} /><button className="button-primary w-full" disabled={busy}>Crear familia</button></form>
      <form onSubmit={event => action(event, 'join')} className="space-y-3"><h3 className="font-bold">Unirme con invitación</h3><label className="field-label" htmlFor="join-display">Tu nombre</label><input className="field" id="join-display" name="display_name" required maxLength={60} /><label className="field-label" htmlFor="join-token">Código de invitación</label><input className="field" id="join-token" name="token" required maxLength={36} autoComplete="off" /><button className="button-primary w-full" disabled={busy}>Unirme a la familia</button></form>
    </div>}
  </div>
}
