import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NotificacionesFamilia from "@/components/NotificacionesFamilia";

const SECCIONES = ["avisos", "notas", "asistencia", "anotaciones"] as const;
type Seccion = (typeof SECCIONES)[number];

type Boton = {
  href: string;
  icono: string;
  titulo: string;
  descripcion: string;
  color: string;
  seccion?: Seccion;
};

const BOTONES_GRANDES: Boton[] = [
  {
    href: "/familia/inscripcion",
    icono: "📝",
    titulo: "Inscripción",
    descripcion: "Inscribir a un hijo/a nuevo",
    color: "bg-[#EAF0FF] border-[#C9D8FF]",
  },
  {
    href: "/familia/asistencia",
    icono: "📅",
    titulo: "Asistencia",
    descripcion: "Días presentes y ausentes",
    color: "bg-[#E7F3EB] border-[#BFE3CB]",
    seccion: "asistencia",
  },
  {
    href: "/familia/anotaciones",
    icono: "🗒️",
    titulo: "Anotaciones",
    descripcion: "Registro anecdótico del/a estudiante",
    color: "bg-[#FBEAE8] border-[#F3C9C4]",
    seccion: "anotaciones",
  },
  {
    href: "/familia/notas",
    icono: "📊",
    titulo: "Notas",
    descripcion: "Ver y descargar las calificaciones",
    color: "bg-[#FFF3DF] border-[#F3DBAE]",
    seccion: "notas",
  },
  {
    href: "/familia/avisos",
    icono: "📢",
    titulo: "Avisos",
    descripcion: "Convocatorias y reuniones",
    color: "bg-[#EAF0FF] border-[#C9D8FF]",
    seccion: "avisos",
  },
  {
    href: "/familia/acuerdo",
    icono: "🤝",
    titulo: "Acuerdo",
    descripcion: "Acuerdo de convivencia",
    color: "bg-[#EAF0FF] border-[#C9D8FF]",
  },
];

const BOTON_MATRICULACION_2027: Boton = {
  href: "/familia/matriculacion-2027",
  icono: "🖊️",
  titulo: "Matriculación 2027",
  descripcion: "Ficha y Carta de Compromiso",
  color: "bg-[#F3EAFF] border-[#DFC9FF]",
};

export default async function FamiliaInicio() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: familia } = await supabase
    .from("familias")
    .select("id, tutor_nombre, matriculacion_2027_habilitada")
    .eq("tutor_perfil_id", user!.id)
    .maybeSingle();

  const { data: estudiantes } = familia
    ? await supabase
        .from("estudiantes")
        .select("id, nombre_completo, estado, secciones(nombre, cursos(id, grado, turno))")
        .eq("familia_id", familia.id)
    : { data: [] };

  const estudianteIds = (estudiantes ?? []).map((e) => e.id);
  const cursoIds = Array.from(
    new Set(
      (estudiantes ?? [])
        .map((e) => (e.secciones as unknown as { cursos: { id: string } | null } | null)?.cursos?.id)
        .filter((id): id is string => Boolean(id))
    )
  );

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

  let notificaciones: Record<Seccion, number> = { avisos: 0, notas: 0, asistencia: 0, anotaciones: 0 };

  if (familia && estudianteIds.length > 0) {
    const { data: vistas } = await supabase
      .from("familia_notificaciones_vistas")
      .select("seccion, visto_en")
      .eq("familia_id", familia.id);

    const vistoEn: Record<Seccion, string> = {
      avisos: "1970-01-01",
      notas: "1970-01-01",
      asistencia: "1970-01-01",
      anotaciones: "1970-01-01",
    };
    (vistas ?? []).forEach((v) => {
      vistoEn[v.seccion as Seccion] = v.visto_en;
    });

    const filtroAvisos = [
      "nivel.eq.colegio",
      cursoIds.length > 0 ? `and(nivel.eq.curso,curso_id.in.(${cursoIds.join(",")}))` : null,
      `and(nivel.eq.estudiante,estudiante_id.in.(${estudianteIds.join(",")}))`,
    ]
      .filter(Boolean)
      .join(",");

    const [avisosCount, notasCount, asistenciaCount, anotacionesCount] = await Promise.all([
      supabase.from("avisos").select("id", { count: "exact", head: true }).gt("creado_en", vistoEn.avisos).or(filtroAvisos),
      supabase
        .from("calificaciones")
        .select("id", { count: "exact", head: true })
        .in("estudiante_id", estudianteIds)
        .gt("actualizado_en", vistoEn.notas),
      supabase
        .from("asistencias")
        .select("id", { count: "exact", head: true })
        .in("estudiante_id", estudianteIds)
        .gt("creado_en", vistoEn.asistencia),
      supabase
        .from("registros_anecdoticos")
        .select("id", { count: "exact", head: true })
        .in("estudiante_id", estudianteIds)
        .eq("visible_familia", true)
        .gt("creado_en", vistoEn.anotaciones),
    ]);

    notificaciones = {
      avisos: avisosCount.count ?? 0,
      notas: notasCount.count ?? 0,
      asistencia: asistenciaCount.count ?? 0,
      anotaciones: anotacionesCount.count ?? 0,
    };
  }

  const botones: Boton[] = familia?.matriculacion_2027_habilitada
    ? [...BOTONES_GRANDES, BOTON_MATRICULACION_2027]
    : BOTONES_GRANDES;

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
          {botones.map((b) => {
            const cantidad = b.seccion ? notificaciones[b.seccion] : 0;
            return (
              <Link
                key={b.href}
                href={b.href}
                className={`${b.color} border rounded-2xl p-5 flex flex-col items-center text-center gap-1.5 hover:opacity-85 active:scale-[0.98] transition relative`}
              >
                {cantidad > 0 && (
                  <span className="absolute top-2 right-2 bg-danger text-white text-[11px] font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1">
                    {cantidad}
                  </span>
                )}
                <span className="text-4xl leading-none">{b.icono}</span>
                <span className="font-display font-bold text-base mt-1">{b.titulo}</span>
                <span className="text-xs text-text-soft">{b.descripcion}</span>
              </Link>
            );
          })}
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
          Todavía no tenés hijos/as cargados en tu cuenta. Usá el botón &quot;Inscripción&quot; de abajo para empezar.
        </div>
      )}
    </div>
  );
}
