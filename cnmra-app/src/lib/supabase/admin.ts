// Cliente de Supabase "administrador" — SOLO para usarse del lado del servidor
// (Route Handlers), nunca en código que corre en el navegador.
// Usa la Service Role Key, que se salta las reglas de RLS, así puede leer
// datos de cualquier familia para poder enviarle su notificación.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
