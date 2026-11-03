// Copia a Google Drive los archivos nuevos de la plataforma (legajos, planes, proyectos).
// Lo ejecuta Vercel cada noche (cron). También lo puede abrir la Dirección a mano
// entrando a /api/cron/respaldo con su sesión iniciada.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { carpeta, subirArchivo, tokenGoogle } from "@/lib/respaldo-google";
import { BUCKET, cab, limpio, listar, mimeDe, nombres, yaCopiadas, type Config } from "@/lib/respaldo-datos";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TIEMPO_MAX_MS = 48000;

async function autorizado(req: Request): Promise<boolean> {
  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.get("authorization") === `Bearer ${secreto}`) return true;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  return data?.rol === "director";
}

export async function GET(req: Request) {
  if (!(await autorizado(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const raiz = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!url || !key || !raiz) return NextResponse.json({ error: "Faltan variables de entorno" }, { status: 500 });
  const cfg: Config = { url, key };

  const inicio = Date.now();
  const token = await tokenGoogle();
  const [todas, hechas, mapaNombres] = await Promise.all([listar(cfg, ""), yaCopiadas(cfg), nombres(cfg)]);
  const pendientes = todas.filter((r) => !hechas.has(r));
  const memoria = new Map<string, string>();
  let subidos = 0;
  const errores: string[] = [];

  for (const ruta of pendientes) {
    if (Date.now() - inicio > TIEMPO_MAX_MS) break;
    try {
      const [uid, tipo, ...resto] = ruta.split("/");
      const archivo = resto.join("/") || tipo;
      const dl = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${ruta.split("/").map(encodeURIComponent).join("/")}`, {
        headers: cab(cfg.key),
      });
      if (!dl.ok) throw new Error("No se pudo leer " + ruta);
      const bytes = await dl.arrayBuffer();
      const quien = limpio(mapaNombres.get(uid) || uid) || uid;
      const dDoc = await carpeta(token, raiz, quien, memoria);
      const dTipo = resto.length > 0 ? await carpeta(token, dDoc, limpio(tipo), memoria) : dDoc;
      const id = await subirArchivo(token, dTipo, archivo, mimeDe(archivo), bytes);
      await fetch(`${cfg.url}/rest/v1/respaldo_drive`, {
        method: "POST",
        headers: cab(cfg.key, { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }),
        body: JSON.stringify({ ruta, drive_id: id }),
      });
      subidos++;
    } catch (e) {
      errores.push((e as Error).message);
    }
  }

  return NextResponse.json({ total: todas.length, copiadosAhora: subidos, faltan: pendientes.length - subidos, errores });
}
