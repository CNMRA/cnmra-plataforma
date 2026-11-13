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
  const f = await fetch(`${url}/rest/v1/familias?select=id&id=eq.${id}`, { headers: cab, cache: "no-store" });
  const filas = f.ok ? ((await f.json()) as unknown[]) : [];
  if (filas.length === 0) return NextResponse.json({ error: "No es una cuenta de familia." }, { status: 404 });

  const r = await fetch(`${url}/auth/v1/admin/users/${id}`, {
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
