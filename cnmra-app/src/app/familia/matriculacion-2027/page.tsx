import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ANIO_LECTIVO = 2027;

// Desde esta fecha (hora de Paraguay) la matriculación 2027 está abierta para todas las familias.
const FECHA_APERTURA_MATRICULACION = "2026-11-23";

function matriculacionAbierta(): boolean {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Asuncion" });
  return hoy >= FECHA_APERTURA_MATRICULACION;
}

export default async function Matriculacion2027Lista() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: familia } = await supabase
    .from("familias")
    .select("id, matriculacion_2027_habilitada")
    .eq("tutor_perfil_id", user!.id)
    .maybeSingle();

  if (!matriculacionAbierta() && !familia?.matriculacion_2027_habilitada) {
    return (
      <div className="flex flex-col gap-4">
        <div><h1 className="font-display text-2xl">Matriculación 2027</h1></div>
        <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
          Disponible próximamente.
        </div>
      </div>
    );
  }

  if (!familia) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl">Matriculación 2027</h1>
          <p className="text-sm text-text-soft mt-1">
            Completá los datos y la Carta de Compromiso de cada hijo/a para el año lectivo 2027.
          </p>
        </div>
        <Link
          href="/familia/matriculacion-2027/nuevo"
          className="bg-[#EAF0FF] border border-[#C9D8FF] rounded-xl p-4 flex items-center gap-3 hover:opacity-85 active:scale-[0.98] transition w-fit"
        >
          <span className="text-2xl leading-none">➕</span>
          <span className="font-display font-bold text-sm">Inscribir un hijo/a nuevo</span>
        </Link>
        <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
          No tenés hijos/as cargados todavía.
        </div>
      </div>
    );
  }

  const { data: estudiantes } = await supabase
    .from("estudiantes")
    .select("id, nombre_completo")
    .eq("familia_id", familia.id)
    .eq("estado", "activo")
    .order("nombre_completo");

  const { data: fichas } = await supabase
    .from("fichas_matriculacion")
    .select("estudiante_id, completado_en")
    .eq("anio_lectivo", ANIO_LECTIVO)
    .in("estudiante_id", (estudiantes ?? []).map((e) => e.id));

  const estadoPorEstudiante = new Map((fichas ?? []).map((f) => [f.estudiante_id, f.completado_en]));
  const hayHijos = (estudiantes ?? []).length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Matriculación 2027</h1>
        <p className="text-sm text-text-soft mt-1">
          Completá los datos y la Carta de Compromiso de cada hijo/a para el año lectivo 2027.
        </p>
      </div>

      {hayHijos && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">
            Tus hijos/as: tocá el nombre de cada uno para empezar o continuar su ficha.
          </p>
          {(estudiantes ?? []).map((e) => {
            const completadoEn = estadoPorEstudiante.get(e.id);
            const estado = completadoEn ? "Completado" : estadoPorEstudiante.has(e.id) ? "En progreso" : "Sin empezar";
            const accion = completadoEn ? "Ver / imprimir →" : estadoPorEstudiante.has(e.id) ? "Continuar →" : "Empezar →";
            const color =
              estado === "Completado" ? "bg-[#E6F4EC] text-[#1E7A47]" :
              estado === "En progreso" ? "bg-[#FBF3DE] text-[#8A6D1B]" : "bg-bg text-text-soft";
            return (
              <Link
                key={e.id}
                href={`/familia/matriculacion-2027/${e.id}`}
                className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 hover:opacity-85 active:scale-[0.99] transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{e.nombre_completo}</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color}`}>{estado}</span>
                </div>
                <span className="text-xs font-semibold text-teal">{accion}</span>
              </Link>
            );
          })}
        </div>
      )}

      {!hayHijos && (
        <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
          No tenés hijos/as cargados todavía.
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Link
          href="/familia/matriculacion-2027/nuevo"
          className="bg-[#EAF0FF] border border-[#C9D8FF] rounded-xl p-4 flex items-center gap-3 hover:opacity-85 active:scale-[0.98] transition w-fit"
        >
          <span className="text-2xl leading-none">➕</span>
          <span className="font-display font-bold text-sm">Inscribir un hijo/a nuevo</span>
        </Link>
        {hayHijos && (
          <p className="text-xs text-text-soft">
            Usalo solo si tu hijo/a todavía no aparece en la lista de arriba.
          </p>
        )}
      </div>
    </div>
  );
}
