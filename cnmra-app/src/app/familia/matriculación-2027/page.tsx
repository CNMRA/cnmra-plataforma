import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ANIO_LECTIVO = 2027;

export default async function Matriculacion2027Lista() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: familia } = await supabase
    .from("familias")
    .select("id, matriculacion_2027_habilitada")
    .eq("tutor_perfil_id", user!.id)
    .maybeSingle();

  if (!familia || !familia.matriculacion_2027_habilitada) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-2xl">Matriculación 2027</h1>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
          Disponible próximamente.
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Matriculación 2027</h1>
        <p className="text-sm text-text-soft mt-1">
          Completá los datos y la Carta de Compromiso de cada hijo/a para el año lectivo 2027.
        </p>
      </div>

      {(!estudiantes || estudiantes.length === 0) && (
        <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
          No tenés hijos/as cargados todavía.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {(estudiantes ?? []).map((e) => {
          const completadoEn = estadoPorEstudiante.get(e.id);
          const estado = completadoEn ? "Completado" : estadoPorEstudiante.has(e.id) ? "En progreso" : "Sin empezar";
          const color =
            estado === "Completado"
              ? "bg-[#E6F4EC] text-[#1E7A47]"
              : estado === "En progreso"
              ? "bg-[#FBF3DE] text-[#8A6D1B]"
              : "bg-bg text-text-soft";
          return (
            <Link
              key={e.id}
              href={`/familia/matriculacion-2027/${e.id}`}
              className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3 hover:opacity-85"
            >
              <span className="text-sm font-semibold">{e.nombre_completo}</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color}`}>{estado}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
