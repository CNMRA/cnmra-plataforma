// API interna: la Dirección le pone una clave nueva a la cuenta de una familia
// (por ejemplo, cuando una mamá o un papá se olvidó la contraseña).
// Usa la clave de administrador de Supabase, que nunca llega al navegador.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function esDirector(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  return data?.rol === "director";
}

export async function POST(req: Request) {
  if (!(await esDirector())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Falta la clave de administrador en Vercel." }, { status: 500 });

  let body: { id?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const id = body.id ?? "";
  const password = body.password ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Cuenta inválida." }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "La clave debe tener al menos 6 caracteres." }, { status: 400 });

  const cab: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) cab.Authorization = `Bearer ${key}`;

  // Solo se puede cambiar la clave de cuentas que sean de familias.
  const f = await fetch(`${url}/rest/v1/familias?select=id,tutor_email&id=eq.${id}`, { headers: cab, cache: "no-store" });
  const filas = f.ok ? ((await f.json()) as { id: string; tutor_email: string | null }[]) : [];
  if (filas.length === 0) return NextResponse.json({ error: "No es una cuenta de familia." }, { status: 404 });

  // La cuenta de acceso puede tener otro código interno: se busca por id y, si no, por correo.
  let cuentaId: string | null = null;
  const directo = await fetch(`${url}/auth/v1/admin/users/${id}`, { headers: cab, cache: "no-store" });
  if (directo.ok) cuentaId = id;

  const correo = (filas[0].tutor_email ?? "").trim().toLowerCase();
  if (!cuentaId && correo) {
    for (let pagina = 1; pagina <= 20 && !cuentaId; pagina++) {
      const lista = await fetch(`${url}/auth/v1/admin/users?page=${pagina}&per_page=200`, { headers: cab, cache: "no-store" });
      if (!lista.ok) break;
      const d = (await lista.json()) as { users?: { id: string; email?: string }[] };
      const usuarios = d.users ?? [];
      const hallado = usuarios.find((u) => (u.email ?? "").toLowerCase() === correo);
      if (hallado) cuentaId = hallado.id;
      if (usuarios.length < 200) break;
    }
  }
  if (!cuentaId) {
    return NextResponse.json(
      { error: correo ? "No se encontró una cuenta de acceso con el correo " + correo + "." : "Esta familia no tiene correo cargado." },
      { status: 404 },
    );
  }

  const r = await fetch(`${url}/auth/v1/admin/users/${cuentaId}`, {
    method: "PUT",
    headers: cab,
    body: JSON.stringify({ password }),
  });
  if (!r.ok) {
    const texto = await r.text();
    return NextResponse.json({ error: "No se pudo cambiar la clave: " + texto.slice(0, 200) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
