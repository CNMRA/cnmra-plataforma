// API interna para que Dirección cree cuentas de docentes y les cambie la clave.
// Usa la clave de administrador de Supabase (SUPABASE_SERVICE_ROLE_KEY), que NUNCA
// llega al navegador: este archivo solo se ejecuta en el servidor.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DOMINIO = "cnmra.edu.py";
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
    `${cfg.url}/rest/v1/perfiles?select=id,nombre_completo&rol=eq.docente&order=nombre_completo`,
    { headers: cabeceras(cfg.key), cache: "no-store" }
  );
  if (!rp.ok) {
    return NextResponse.json({ error: "No se pudo leer la lista de docentes." }, { status: 500 });
  }
  const perfiles = (await rp.json()) as { id: string; nombre_completo: string }[];
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

  let body: { accion?: string; docentes?: Entrada[]; id?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
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
