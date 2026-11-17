import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

function configuredClient() {
  if (!url || !key || key.startsWith('sb_secret_')) return null
  try {
    return createClient(url, key)
  } catch {
    // Un dato de configuración incorrecto no debe impedir usar la lista local.
    return null
  }
}

// Sin configuración válida se conserva el modo local, sin iniciar conexiones.
export const supabase = configuredClient()
