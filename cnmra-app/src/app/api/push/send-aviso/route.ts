import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Este endpoint NO lo llama una persona: lo llama Supabase automáticamente
// (un disparador en la base de datos) cada vez que se crea una fila nueva en
// la tabla "avisos". Según el nivel del aviso (colegio / curso / estudiante),
// buscamos a qué familias les corresponde y les mandamos la notificación
// push al celular.

type AvisoRow = {
  id: string;
  nivel: "colegio" | "curso" | "estudiante";
  curso_id: string | null;
  estudiante_id: string | null;
  titulo: string;
  contenido: string;
};

export async function POST(request: Request) {
  const secretRecibido = request.headers.get("x-webhook-secret");
  if (!secretRecibido || secretRecibido !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const record = body?.record as AvisoRow | undefined;
  if (!record?.nivel || !record?.titulo) {
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

  let perfilesIds: string[] = [];

  if (record.nivel === "colegio") {
    const { data: familias } = await admin.from("familias").select("tutor_perfil_id").not("tutor_perfil_id", "is", null);
    perfilesIds = (familias ?? []).map((f) => f.tutor_perfil_id as string);
  } else if (record.nivel === "curso" && record.curso_id) {
    const { data: secciones } = await admin.from("secciones").select("id").eq("curso_id", record.curso_id);
    const seccionIds = (secciones ?? []).map((s) => s.id);
    if (seccionIds.length > 0) {
      const { data: estudiantes } = await admin.from("estudiantes").select("familia_id").in("seccion_id", seccionIds);
      const familiaIds = [...new Set((estudiantes ?? []).map((e) => e.familia_id))];
      if (familiaIds.length > 0) {
        const { data: familias } = await admin
          .from("familias")
          .select("tutor_perfil_id")
          .in("id", familiaIds)
          .not("tutor_perfil_id", "is", null);
        perfilesIds = (familias ?? []).map((f) => f.tutor_perfil_id as string);
      }
    }
  } else if (record.nivel === "estudiante" && record.estudiante_id) {
    const { data: estudiante } = await admin.from("estudiantes").select("familia_id").eq("id", record.estudiante_id).maybeSingle();
    if (estudiante) {
      const { data: familia } = await admin.from("familias").select("tutor_perfil_id").eq("id", estudiante.familia_id).maybeSingle();
      if (familia?.tutor_perfil_id) perfilesIds = [familia.tutor_perfil_id];
    }
  }

  if (perfilesIds.length === 0) {
    return NextResponse.json({ ok: true, enviados: 0, motivo: "sin destinatarios" });
  }

  const { data: suscripciones } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("perfil_id", perfilesIds);

  if (!suscripciones || suscripciones.length === 0) {
    return NextResponse.json({ ok: true, enviados: 0, motivo: "sin notificaciones activadas" });
  }

  const payload = JSON.stringify({ titulo: `Aviso · ${record.titulo}`, mensaje: record.contenido, url: "/familia" });

  let enviados = 0;
  await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        enviados += 1;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    })
  );

  return NextResponse.json({ ok: true, enviados });
}
