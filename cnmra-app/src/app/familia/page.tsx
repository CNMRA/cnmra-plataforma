import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NotificacionesFamilia from "@/components/NotificacionesFamilia";

const BOTONES_GRANDES = [
  {
    href: "/familia/inscripcion",
    icono: "📝",
    titulo: "Inscripción",
    descripcion: "Inscribir a un hijo/a nuevo",
    color: "bg-[#EAF0FF] border-[#C9D8FF]",
  },
  {
    href: "/familia/acuerdo",
    icono: "🤝",
    titulo: "Acuerdo",
    descripcion: "Acuerdo de convivencia",
    color: "bg-[#EAF0FF] border-[#C9D8FF]",
  },
  {
    href: "/familia/asistencia",
    icono: "📅",
    titulo: "Asistencia",
    descripcion: "Días presentes y ausentes",
    color: "bg-[#E7F3EB] border-[#BFE3CB]",
  },
  {
    href: "/familia/notas",
    icono: "📊",
    titulo: "Notas",
    descripcion: "Ver y descargar las calificaciones",
    color: "bg-[#FFF3DF] border-[#F3DBAE]",
  },
  {
    href: "/familia/anotaciones",
    icono: "🗒️",
    titulo: "Anotaciones",
    descripcion: "Registro anecdótico del/a estudiante",
    color: "bg-[#FBEAE8] border-[#F3C9C4]",
  },
];

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

      <div>
        <h2 className="text-[13px] font-semibold text-text-soft uppercase tracking-wide mb-3">¿Qué necesitás hacer?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {BOTONES_GRANDES.map((b) => (
            <Link
              key={b.href}
              href={b.href}
              className={`${b.color} border rounded-2xl p-5 flex flex-col items-center text-center gap-1.5 hover:opacity-85 active:scale-[0.98] transition`}
            >
              <span className="text-4xl leading-none">{b.icono}</span>
              <span className="font-display font-bold text-base mt-1">{b.titulo}</span>
              <span className="text-xs text-text-soft">{b.descripcion}</span>
            </Link>
          ))}
        </div>
      </div>

      {estudiantes && estudiantes.length > 0 && (
        <div>
          <h2 className="text-[13px] font-semibold text-text-soft uppercase tracking-wide mb-3">Tus hijos/as</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {estudiantes.map((e) => {
              const seccion = e.secciones as unknown as { nombre: string; cursos: { grado: string; turno: string } | null } | null;
              return (
                <div key={e.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
                  <div className="font-semibold">{e.nombre_completo}</div>
                  <div className="text-xs text-text-soft">
                    {seccion?.cursos ? `${seccion.cursos.grado} "${seccion.nombre}" · Turno ${seccion.cursos.turno}` : "Curso sin asignar todavía"}
                  </div>
                  <Link href={`/familia/estudiante/${e.id}/editar`} className="text-xs text-teal font-medium self-start">
                    Editar datos →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
