import { NextResponse } from "next/server";

// Devuelve la hora actual del servidor, para que las pantallas no dependan del reloj del celular.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ahora: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
