import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Este endpoint NO lo llama una persona: lo llama Supabase automáticamente
// (un "Database Webhook") cada vez que se crea una fila nueva en la tabla
// "alertas" — ya sea porque Dirección escribió una a mano, o porque se
// generó sola al cargar una ausencia, un registro o una nota.
// Acá buscamos a qué familia pertenece esa alerta y le mandamos la
// notificación push a su celular.

const TIPO_TITULO: Record<string, string> = {
  inasistencia: "Asistencia",
  academica: "Notas",
  conducta: "Seguimiento",
  acuerdo_pendiente: "Acuerdo de convivencia",
  otro: "CNMRA",
};

type AlertaRow = {
  id: string;
  estudiante_id: string;
  tipo: string;
  mensaje: string;
};

export async function POST(request: Request) {
  const secretRecibido = request.headers.get("x-webhook-secret");
  if (!secretRecibido || secretRecibido !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const record = body?.record as AlertaRow | undefined;
  if (!record?.estudiante_id || !record?.mensaje) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return NextResponse.json({ error: "Faltan las claves VAPID en el servidor." }, { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const admin = createAdminClient();

  const { data: estudiante } = await admin
    .from("estudiantes")
    .select("nombre_completo, familia_id")
    .eq("id", record.estudiante_id)
    .maybeSingle();

  if (!estudiante) {
    return NextResponse.json({ ok: true, enviados: 0, motivo: "estudiante no encontrado" });
  }

  const { data: familia } = await admin
    .from("familias")
    .select("tutor_perfil_id")
    .eq("id", estudiante.familia_id)
    .maybeSingle();

  if (!familia?.tutor_perfil_id) {
    return NextResponse.json({ ok: true, enviados: 0, motivo: "familia sin cuenta vinculada" });
  }

  const { data: suscripciones } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("perfil_id", familia.tutor_perfil_id);

  if (!suscripciones || suscripciones.length === 0) {
    return NextResponse.json({ ok: true, enviados: 0, motivo: "sin notificaciones activadas" });
  }

  const titulo = `${TIPO_TITULO[record.tipo] ?? "CNMRA"} · ${estudiante.nombre_completo}`;
  const payload = JSON.stringify({ titulo, mensaje: record.mensaje, url: "/familia" });

  let enviados = 0;
  await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        enviados += 1;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // La suscripción venció o el celular la desactivó: la borramos.
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    })
  );

  return NextResponse.json({ ok: true, enviados });
}
