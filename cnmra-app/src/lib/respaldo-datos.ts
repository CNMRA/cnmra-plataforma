// Ayudantes para leer los archivos de la plataforma (solo se usa en el servidor).

export const BUCKET = "planes-docentes";

export type Config = { url: string; key: string };

export function cab(key: string, extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { apikey: key, ...extra };
  if (key.startsWith("eyJ")) h.Authorization = `Bearer ${key}`;
  return h;
}

export async function listar(cfg: Config, prefijo: string, nivel = 0): Promise<string[]> {
  const r = await fetch(`${cfg.url}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: cab(cfg.key, { "Content-Type": "application/json" }),
    body: JSON.stringify({ prefix: prefijo, limit: 1000, offset: 0 }),
  });
  if (!r.ok) return [];
  const items = (await r.json()) as { name: string; id: string | null }[];
  const rutas: string[] = [];
  for (const it of items) {
    const ruta = prefijo ? `${prefijo}/${it.name}` : it.name;
    if (it.id === null) {
      if (nivel < 4) rutas.push(...(await listar(cfg, ruta, nivel + 1)));
    } else rutas.push(ruta);
  }
  return rutas;
}

export async function yaCopiadas(cfg: Config): Promise<Set<string>> {
  const set = new Set<string>();
  for (let desde = 0; desde < 100000; desde += 1000) {
    const r = await fetch(`${cfg.url}/rest/v1/respaldo_drive?select=ruta`, {
      headers: cab(cfg.key, { Range: `${desde}-${desde + 999}` }),
      cache: "no-store",
    });
    if (!r.ok) break;
    const filas = (await r.json()) as { ruta: string }[];
    filas.forEach((f) => set.add(f.ruta));
    if (filas.length < 1000) break;
  }
  return set;
}

export async function nombres(cfg: Config): Promise<Map<string, string>> {
  const r = await fetch(`${cfg.url}/rest/v1/perfiles?select=id,nombre_completo&rol=eq.docente&limit=1000`, {
    headers: cab(cfg.key),
    cache: "no-store",
  });
  const filas = r.ok ? ((await r.json()) as { id: string; nombre_completo: string | null }[]) : [];
  return new Map(filas.map((f) => [f.id, (f.nombre_completo ?? "").trim()]));
}

export function mimeDe(nombre: string): string {
  const e = nombre.toLowerCase().split(".").pop() ?? "";
  if (e === "pdf") return "application/pdf";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "png") return "image/png";
  return "application/octet-stream";
}

export function limpio(t: string): string {
  return t.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}
