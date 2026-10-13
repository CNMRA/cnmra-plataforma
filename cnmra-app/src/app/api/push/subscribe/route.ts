import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Guarda la "suscripción" push del celular de la persona que inició sesión
// (familia o institución), para poder mandarle notificaciones más adelante.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });
  }

  const body = await request.json();
  const { endpoint, keys } = body ?? {};

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Suscripción inválida." }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      perfil_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Permite desactivar las notificaciones en este celular.
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });
  }

  const body = await request.json();
  const { endpoint } = body ?? {};
  if (!endpoint) {
    return NextResponse.json({ error: "Falta el endpoint." }, { status: 400 });
  }

  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("perfil_id", user.id);

  return NextResponse.json({ ok: true });
}
