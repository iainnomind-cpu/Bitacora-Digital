// Supabase ahora emite "publishable keys" (sb_publishable_...) además de la anon key heredada.
// Cualquiera de las dos funciona como clave pública del cliente.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabasePublicKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
