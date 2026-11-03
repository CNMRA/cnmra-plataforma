// API interna para que Dirección cree cuentas de docentes, les cambie la clave,
// edite su nombre, las dé de baja (o de alta) y las elimine.
// Usa la clave de administrador de Supabase (SUPABASE_SERVICE_ROLE_KEY), que NUNCA
// llega al navegador: este archivo solo se ejecuta en el servidor.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DOMINIO = "cnmra.edu.py";
const BUCKET = "planes-docentes";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Config = { url: string; key: string };
type Entrada = { nombre_completo: string; usuario: string; ci: string };
type Resultado = { nombre_completo: string; usuario: string; password: string; ok: boolean; error?: string };

function configuracion(): Config | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

function cabeceras(key: string, extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { apikey: key, "Content-Type": "application/json", ...extra };
  if (key.startsWith("eyJ")) h.Authorization = `Bearer ${key}`;
  return h;
}

async function esDirector(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  return perfil?.rol === "director";
}

async function archivosDe(cfg: Config, prefijo: string, nivel = 0): Promise<string[]> {
  const r = await fetch(`${cfg.url}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: cabeceras(cfg.key),
    body: JSON.stringify({ prefix: prefijo, limit: 1000, offset: 0 }),
  });
  if (!r.ok) return [];
  const items = (await r.json()) as { name: string; id: string | null }[];
  const rutas: string[] = [];
  for (const it of items) {
    const ruta = `${prefijo}/${it.name}`;
    if (it.id === null) {
      if (nivel < 4) rutas.push(...(await archivosDe(cfg, ruta, nivel + 1)));
    } else {
      rutas.push(ruta);
    }
  }
  return rutas;
}

async function esDocente(cfg: Config, id: string): Promise<boolean> {
  const r = await fetch(`${cfg.url}/rest/v1/perfiles?select=id&id=eq.${id}&rol=eq.docente`, {
    headers: cabeceras(cfg.key),
    cache: "no-store",
  });
  const encontrados = r.ok ? ((await r.json()) as unknown[]) : [];
  return encontrados.length > 0;
}

function limpiarUsuario(u: string): string {
  return u
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

async function crearDocente(cfg: Config, d: Entrada): Promise<Resultado> {
  const nombre = (d.nombre_completo ?? "").trim();
  const base = limpiarUsuario(d.usuario ?? "");
  const password = (d.ci ?? "").replace(/\D/g, "");
  const fallo = (error: string): Resultado => ({ nombre_completo: nombre, usuario: base, password, ok: false, error });

  if (!nombre || !base) return fallo("Faltan el nombre o el usuario.");
  if (password.length < 6) return fallo("La CI debe tener al menos 6 números.");

  for (let n = 1; n <= 30; n++) {
    const usuario = n === 1 ? base : `${base}${String(n).padStart(2, "0")}`;
    const r = await fetch(`${cfg.url}/auth/v1/admin/users`, {
      method: "POST",
      headers: cabeceras(cfg.key),
      body: JSON.stringify({
        email: `${usuario}@${DOMINIO}`,
        password,
        email_confirm: true,
        user_metadata: { nombre_completo: nombre },
      }),
    });

    if (r.ok) {
      const creado = (await r.json()) as { id: string };
      const p = await fetch(`${cfg.url}/rest/v1/perfiles?on_conflict=id`, {
        method: "POST",
        headers: cabeceras(cfg.key, { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ id: creado.id, nombre_completo: nombre, rol: "docente", activo: true }),
      });
      if (!p.ok) {
        const detalle = await p.text();
        await fetch(`${cfg.url}/auth/v1/admin/users/${creado.id}`, { method: "DELETE", headers: cabeceras(cfg.key) });
        return fallo("No se pudo crear el perfil: " + detalle.slice(0, 200));
      }
      return { nombre_completo: nombre, usuario, password, ok: true };
    }

    const texto = await r.text();
    const yaExiste = r.status === 422 && /already|exists|registered/i.test(texto);
    if (!yaExiste) return fallo("No se pudo crear la cuenta: " + texto.slice(0, 200));
  }
  return fallo("Hay demasiados usuarios con ese mismo nombre.");
}

export async function GET() {
  if (!(await esDirector())) {
    return NextResponse.json({ error: "Solo Dirección puede ver esta sección." }, { status: 403 });
  }
  const cfg = configuracion();
  if (!cfg) {
    return NextResponse.json(
      { error: "Falta configurar la clave de administrador (SUPABASE_SERVICE_ROLE_KEY) en Vercel." },
      { status: 500 }
    );
  }

  const rp = await fetch(
    `${cfg.url}/rest/v1/perfiles?select=id,nombre_completo,activo&rol=eq.docente&order=nombre_completo`,
    { headers: cabeceras(cfg.key), cache: "no-store" }
  );
  if (!rp.ok) {
    return NextResponse.json({ error: "No se pudo leer la lista de docentes." }, { status: 500 });
  }
  const perfiles = (await rp.json()) as { id: string; nombre_completo: string; activo: boolean }[];
  const ids = new Set(perfiles.map((p) => p.id));

  const usuarios = new Map<string, string>();
  for (let pagina = 1; pagina <= 10; pagina++) {
    const r = await fetch(`${cfg.url}/auth/v1/admin/users?page=${pagina}&per_page=200`, {
      headers: cabeceras(cfg.key),
      cache: "no-store",
    });
    if (!r.ok) break;
    const j = (await r.json()) as { users?: { id: string; email?: string }[] };
    const lista = j.users ?? [];
    lista.forEach((u) => {
      if (ids.has(u.id)) usuarios.set(u.id, (u.email ?? "").split("@")[0]);
    });
    if (lista.length < 200) break;
  }

  return NextResponse.json({
    docentes: perfiles.map((p) => ({
      id: p.id,
      nombre_completo: p.nombre_completo,
      activo: p.activo !== false,
      usuario: usuarios.get(p.id) ?? "",
    })),
  });
}

export async function POST(request: Request) {
  if (!(await esDirector())) {
    return NextResponse.json({ error: "Solo Dirección puede hacer esto." }, { status: 403 });
  }
  const cfg = configuracion();
  if (!cfg) {
    return NextResponse.json(
      { error: "Falta configurar la clave de administrador (SUPABASE_SERVICE_ROLE_KEY) en Vercel." },
      { status: 500 }
    );
  }

  let body: { accion?: string; docentes?: Entrada[]; id?: string; password?: string; nombre_completo?: string; activo?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  if (body.accion === "editar" || body.accion === "baja" || body.accion === "eliminar") {
    const id = body.id ?? "";
    if (!UUID.test(id)) return NextResponse.json({ error: "Docente inválido." }, { status: 400 });
    if (!(await esDocente(cfg, id))) {
      return NextResponse.json({ error: "Esa cuenta no es de un docente." }, { status: 400 });
    }

    if (body.accion === "editar") {
      const nombre = (body.nombre_completo ?? "").trim();
      if (nombre.length < 3) return NextResponse.json({ error: "Escribí el nombre completo." }, { status: 400 });
      const p = await fetch(`${cfg.url}/rest/v1/perfiles?id=eq.${id}`, {
        method: "PATCH",
        headers: cabeceras(cfg.key, { Prefer: "return=minimal" }),
        body: JSON.stringify({ nombre_completo: nombre }),
      });
      if (!p.ok) return NextResponse.json({ error: "No se pudo guardar el nombre." }, { status: 500 });
      await fetch(`${cfg.url}/auth/v1/admin/users/${id}`, {
        method: "PUT",
        headers: cabeceras(cfg.key),
        body: JSON.stringify({ user_metadata: { nombre_completo: nombre } }),
      });
      return NextResponse.json({ ok: true });
    }

    if (body.accion === "baja") {
      const activo = body.activo === true;
      const p = await fetch(`${cfg.url}/rest/v1/perfiles?id=eq.${id}`, {
        method: "PATCH",
        headers: cabeceras(cfg.key, { Prefer: "return=minimal" }),
        body: JSON.stringify({ activo }),
      });
      if (!p.ok) return NextResponse.json({ error: "No se pudo cambiar el estado." }, { status: 500 });
      const b = await fetch(`${cfg.url}/auth/v1/admin/users/${id}`, {
        method: "PUT",
        headers: cabeceras(cfg.key),
        body: JSON.stringify({ ban_duration: activo ? "none" : "876000h" }),
      });
      if (!b.ok) return NextResponse.json({ error: "No se pudo bloquear o habilitar el ingreso." }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // eliminar definitivamente: archivos, datos y cuenta
    const rutas = await archivosDe(cfg, id);
    for (let i = 0; i < rutas.length; i += 500) {
      await fetch(`${cfg.url}/storage/v1/object/${BUCKET}`, {
        method: "DELETE",
        headers: cabeceras(cfg.key),
        body: JSON.stringify({ prefixes: rutas.slice(i, i + 500) }),
      });
    }
    await fetch(`${cfg.url}/rest/v1/documentos_docentes?docente_id=eq.${id}`, {
      method: "DELETE",
      headers: cabeceras(cfg.key),
    });
    await fetch(`${cfg.url}/rest/v1/legajos_docentes?docente_id=eq.${id}`, {
      method: "DELETE",
      headers: cabeceras(cfg.key),
    });
    await fetch(`${cfg.url}/rest/v1/perfiles?id=eq.${id}`, { method: "DELETE", headers: cabeceras(cfg.key) });
    const d = await fetch(`${cfg.url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: cabeceras(cfg.key) });
    if (!d.ok) {
      const texto = await d.text();
      return NextResponse.json({ error: "No se pudo eliminar la cuenta: " + texto.slice(0, 200) }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.accion === "clave") {
    const id = body.id ?? "";
    const password = body.password ?? "";
    if (!UUID.test(id)) return NextResponse.json({ error: "Docente inválido." }, { status: 400 });
    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }
    const verif = await fetch(`${cfg.url}/rest/v1/perfiles?select=id&id=eq.${id}&rol=eq.docente`, {
      headers: cabeceras(cfg.key),
      cache: "no-store",
    });
    const encontrados = verif.ok ? ((await verif.json()) as unknown[]) : [];
    if (encontrados.length === 0) {
      return NextResponse.json({ error: "Esa cuenta no es de un docente." }, { status: 400 });
    }
    const r = await fetch(`${cfg.url}/auth/v1/admin/users/${id}`, {
      method: "PUT",
      headers: cabeceras(cfg.key),
      body: JSON.stringify({ password }),
    });
    if (!r.ok) {
      const texto = await r.text();
      return NextResponse.json({ error: "No se pudo cambiar la clave: " + texto.slice(0, 200) }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const lista = body.docentes ?? [];
  if (lista.length === 0 || lista.length > 150) {
    return NextResponse.json({ error: "La lista debe tener entre 1 y 150 docentes." }, { status: 400 });
  }
  const resultados: Resultado[] = [];
  for (const d of lista) {
    resultados.push(await crearDocente(cfg, d));
  }
  return NextResponse.json({ resultados });
}
