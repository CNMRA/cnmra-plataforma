import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HambreCeroFormulario from "@/components/HambreCeroFormulario";

const ANIO_LECTIVO = 2027;
const INSTITUCION = "Colegio Nacional Mariano Roque Alonso";

// Desde esta fecha (hora de Paraguay) la matriculación 2027 está abierta para todas las familias.
const FECHA_APERTURA_MATRICULACION = "2026-11-24";

function matriculacionAbierta(): boolean {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Asuncion" });
  return hoy >= FECHA_APERTURA_MATRICULACION;
}

function etiquetaVinculo(v: string | null | undefined) {
  if (v === "padre") return "padre";
  if (v === "madre") return "madre";
  if (v === "responsable") return "encargado/a";
  return "";
}

export default async function HambreCero({ params }: { params: Promise<{ estudianteId: string }> }) {
  const { estudianteId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: familia } = await supabase
    .from("familias")
    .select("id, matriculacion_2027_habilitada")
    .eq("tutor_perfil_id", user!.id)
    .maybeSingle();

  const { data: estudiante } = await supabase
    .from("estudiantes")
    .select("id, nombre_completo, cedula, familia_id")
    .eq("id", estudianteId)
    .maybeSingle();

  if (!familia || (!matriculacionAbierta() && !familia.matriculacion_2027_habilitada) || !estudiante || estudiante.familia_id !== familia.id) {
    notFound();
  }

  const { data: ficha } = await supabase
    .from("fichas_matriculacion")
    .select("id, curso_id, responsable_nombre, responsable_cedula, responsable_vinculo")
    .eq("estudiante_id", estudianteId)
    .eq("anio_lectivo", ANIO_LECTIVO)
    .maybeSingle();

  const { data: curso } = ficha?.curso_id
    ? await supabase.from("cursos").select("grado, turno, enfasis").eq("id", ficha.curso_id).maybeSingle()
    : { data: null };

  const { data: responsablesData } = ficha
    ? await supabase
        .from("responsables_matriculacion")
        .select("nombre, cedula, vinculo")
        .eq("ficha_id", ficha.id)
        .order("orden")
        .limit(1)
    : { data: null };

  const resp =
    responsablesData && responsablesData.length > 0
      ? responsablesData[0]
      : { nombre: ficha?.responsable_nombre ?? "", cedula: ficha?.responsable_cedula ?? "", vinculo: ficha?.responsable_vinculo ?? "" };

  return (
    <HambreCeroFormulario
      d={{
        respNombre: resp.nombre ?? "",
        respCedula: resp.cedula ?? "",
        respVinculo: etiquetaVinculo(resp.vinculo),
        estNombre: estudiante!.nombre_completo ?? "",
        estCedula: estudiante!.cedula ?? "",
        institucion: INSTITUCION,
        gradoCurso: curso ? `${curso.grado}${curso.enfasis ? ` — ${curso.enfasis}` : ""}` : "",
        turno: curso?.turno ?? "",
        volverHref: `/familia/matriculacion-2027/${estudianteId}`,
      }}
    />
  );
}
