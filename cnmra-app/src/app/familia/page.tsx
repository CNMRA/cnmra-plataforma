import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NotificacionesFamilia from "@/components/NotificacionesFamilia";

export default async function FamiliaInicio() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: familia } = await supabase
    .from("familias")
    .select("id, tutor_nombre")
    .eq("tutor_perfil_id", user!.id)
    .maybeSingle();

  const { data: estudiantes } = familia
    ? await supabase
        .from("estudiantes")
        .select("id, nombre_completo, estado, secciones(nombre, cursos(grado, turno))")
        .eq("familia_id", familia.id)
    : { data: [] };

  const { data: alertas } = familia
    ? await supabase
        .from("alertas")
        .select("id, mensaje, severidad, estudiantes(nombre_completo)")
        .in(
          "estudiante_id",
          (estudiantes ?? []).map((e) => e.id)
        )
        .order("creado_en", { ascending: false })
        .limit(5)
    : { data: [] };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Hola, {familia?.tutor_nombre?.split(" ")[0] ?? ""}</h1>
        <p className="text-sm text-text-soft mt-1">Así está el proceso de tus hijos.</p>
      </div>

      <NotificacionesFamilia />

      {alertas && alertas.length > 0 && (
        <div className="bg-[#FBEAE8] border border-[#F3C9C4] rounded-xl p-4 flex flex-col gap-2">
          {alertas.map((a) => (
            <div key={a.id} className="text-sm">
              <span className="font-semibold text-danger">
                {(a.estudiantes as unknown as { nombre_completo: string } | null)?.nombre_completo}
              </span>{" "}
              — {a.mensaje}
            </div>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {(estudiantes ?? []).map((e) => {
          const seccion = e.secciones as unknown as { nombre: string; cursos: { grado: string; turno: string } | null } | null;
          return (
            <Link
              key={e.id}
              href="/familia/seguimiento"
              className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 hover:border-teal"
            >
              <div className="font-semibold">{e.nombre_completo}</div>
              <div className="text-xs text-text-soft">
                {seccion?.cursos ? `${seccion.cursos.grado} "${seccion.nombre}" · Turno ${seccion.cursos.turno}` : "Curso sin asignar todavía"}
              </div>
            </Link>
          );
        })}
      </div>

      {(!estudiantes || estudiantes.length === 0) && (
        <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
          Todavía no tenés hijos/as cargados en tu cuenta.{" "}
          <Link href="/familia/inscripcion" className="text-teal font-medium">
            Iniciar una inscripción
          </Link>
          .
        </div>
      )}
    </div>
  );
}
