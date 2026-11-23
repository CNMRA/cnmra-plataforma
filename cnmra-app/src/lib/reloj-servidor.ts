// Fecha de hoy en Paraguay, tomada del reloj del SERVIDOR (no del celular de la familia).
// Si el celular tiene la fecha mal puesta, igual se usa la fecha correcta.

let desfaseMs = 0;

export function hoyParaguay(): string {
  return new Date(Date.now() + desfaseMs).toLocaleDateString("en-CA", { timeZone: "America/Asuncion" });
}

export async function sincronizarReloj(): Promise<void> {
  try {
    const respuesta = await fetch("/api/hora", { cache: "no-store" });
    if (!respuesta.ok) return;
    const datos = (await respuesta.json()) as { ahora?: number };
    if (typeof datos.ahora === "number" && Number.isFinite(datos.ahora)) {
      desfaseMs = datos.ahora - Date.now();
    }
  } catch {
    // Si no se puede consultar al servidor, se usa el reloj del dispositivo.
  }
}
