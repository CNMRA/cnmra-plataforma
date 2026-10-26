"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Curso = { id: string; grado: string; turno: string; enfasis: string | null };
type Estudiante = { id: string; nombre_completo: string; cedula: string | null; familia_id: string | null };

type Persona = { nombre: string; cedula: string; vinculo: string; telefono: string };

type Ficha = {
  id: string | null;
  tramite: string;
  curso_id: string;
  nacionalidad: string;
  pueblo_indigena: string;
  cobertura_medica: string;
  grupo_sanguineo: string;
  enfermedades_alergias: string;
  discapacidad_apoyo: string;
  responsable_nombre: string;
  responsable_cedula: string;
  responsable_ocupacion: string;
  responsable_vinculo: string;
  responsable_vinculo_otro: string;
  responsable_telefono: string;
  responsable_correo: string;
  responsable_direccion: string;
  segundo_contacto_nombre: string;
  segundo_contacto_vinculo: string;
  segundo_contacto_telefono: string;
  emergencia_nombre: string;
  emergencia_vinculo: string;
  emergencia_telefono: string;
  carta_a_aceptada_en: string | null;
  carta_b_aceptada_en: string | null;
  carta_c_aceptada_en: string | null;
  carta_d_aceptada_en: string | null;
  carta_e_aceptada_en: string | null;
  carta_f_aceptada_en: string | null;
  carta_g_aceptada_en: string | null;
  completado_en: string | null;
};

const ANIO_LECTIVO = 2027;

const FICHA_VACIA: Ficha = {
  id: null,
  tramite: "primera_vez",
  curso_id: "",
  nacionalidad: "Paraguaya",
  pueblo_indigena: "",
  cobertura_medica: "ninguna",
  grupo_sanguineo: "",
  enfermedades_alergias: "",
  discapacidad_apoyo: "",
  responsable_nombre: "",
  responsable_cedula: "",
  responsable_ocupacion: "",
  responsable_vinculo: "madre",
  responsable_vinculo_otro: "",
  responsable_telefono: "",
  responsable_correo: "",
  responsable_direccion: "",
  segundo_contacto_nombre: "",
  segundo_contacto_vinculo: "",
  segundo_contacto_telefono: "",
  emergencia_nombre: "",
  emergencia_vinculo: "",
  emergencia_telefono: "",
  carta_a_aceptada_en: null,
  carta_b_aceptada_en: null,
  carta_c_aceptada_en: null,
  carta_d_aceptada_en: null,
  carta_e_aceptada_en: null,
  carta_f_aceptada_en: null,
  carta_g_aceptada_en: null,
  completado_en: null,
};

const CARTA_SECCIONES: { letra: string; titulo: string; puntos: string[]; campo: keyof Ficha }[] = [
  {
    letra: "A",
    titulo: "Convivencia, acompañamiento y comunicación",
    campo: "carta_a_aceptada_en",
    puntos: [
      "Respetar y cumplir las Normas de Convivencia Institucional, el Código de la Niñez y la Adolescencia (Ley N° 1.680/2001) y las demás normativas vigentes.",
      "Acompañar de forma cercana y constante el proceso educativo del/de la estudiante, revisando periódicamente sus tareas, calificaciones y los comunicados de la institución.",
      "Asistir a las reuniones de padres, entrevistas y citaciones de la institución, y mantener actualizados los datos de contacto.",
      "Promover un ambiente de respeto, buen trato y valores éticos y democráticos; respetar los canales de comunicación institucionales ante dudas o reclamos, y recurrir al diálogo como forma de resolver los conflictos.",
    ],
  },
  {
    letra: "B",
    titulo: "Asistencia, puntualidad y retiro",
    campo: "carta_b_aceptada_en",
    puntos: [
      "Asegurar la asistencia regular y puntual, con llegada 10 minutos antes del inicio para la formación general, y la permanencia del/de la estudiante durante toda la jornada.",
      "Justificar toda ausencia dentro de las 24 horas, sabiendo que tres llegadas tardías equivalen a un día de ausencia y que las ausencias en días de examen deben justificarse el mismo día.",
      "Retirar anticipadamente al/a la estudiante solo de forma personal (o por un adulto autorizado en el punto IV de este formulario), registrando la salida en Secretaría. No se aceptarán retiros por llamada telefónica.",
    ],
  },
  {
    letra: "C",
    titulo: "Uniforme y presentación personal",
    campo: "carta_c_aceptada_en",
    puntos: [
      "Garantizar que el/la estudiante asista todos los días con el uniforme completo que corresponda (diario, de gala o de Educación Física) y con una presentación personal adecuada.",
      "Si el/la estudiante se presenta sin uniforme, no se le permitirá el acceso a clases. La institución comunicará de inmediato a la familia, que deberá acercar el uniforme o retirar personalmente al/a la estudiante; mientras tanto, permanecerá bajo el cuidado de un adulto de la institución. Solo se considerarán las situaciones excepcionales comunicadas y justificadas previamente ante la Dirección.",
      "No utilizar el uniforme fuera del horario y de las actividades escolares, por tratarse de la imagen de la institución.",
    ],
  },
  {
    letra: "D",
    titulo: "Celulares y aparatos electrónicos",
    campo: "carta_d_aceptada_en",
    puntos: [
      "No enviar al/a la estudiante con celular ni con otros aparatos electrónicos personales (tablets, relojes inteligentes, auriculares, etc.). Ante una emergencia, la familia y el/la estudiante se comunicarán a través del teléfono de la Secretaría o Dirección de turno.",
      "En casos excepcionales (salud, discapacidad o estudiante trabajador/a) autorizados por escrito por la Dirección, el dispositivo deberá entregarse apagado al inicio de la jornada y se devolverá al finalizarla. Todo aparato retenido por incumplimiento será devuelto únicamente al padre, la madre o el tutor/a. La institución no se responsabiliza por pérdida o daño de dispositivos.",
      "No fotografiar, filmar, grabar ni difundir imágenes de compañeros/as, docentes o personal de la institución sin su consentimiento (Ley N° 7.593/2025).",
    ],
  },
  {
    letra: "E",
    titulo: "Limpieza y cuidado de los espacios",
    campo: "carta_e_aceptada_en",
    puntos: [
      "Colaborar activamente con la limpieza y el orden de todos los espacios de uso estudiantil —aulas, patio, sanitarios, pasillos, biblioteca, laboratorios y cantina— según el cronograma organizado por el/la profesor/a guía, y dejar el aula limpia y ordenada al terminar la jornada.",
      "Arrojar los residuos en los basureros, hacer un uso higiénico de los sanitarios y cuidar el agua, la luz y las instalaciones.",
      "Cuidar el mobiliario y los bienes de la institución. En caso de daño deliberado o por negligencia, la familia asumirá su reparación o reposición (Normas de Convivencia, punto 7.5).",
    ],
  },
  {
    letra: "F",
    titulo: "Seguridad y responsabilidad",
    campo: "carta_f_aceptada_en",
    puntos: [
      "No portar armas, objetos peligrosos, bebidas alcohólicas, cigarrillos, vapeadores ni sustancias prohibidas, y aceptar los protocolos de seguridad institucional, incluida la revisión de mochilas (Res. MEC N° 183/2023 y N° 845/2023).",
      "Proveer al/a la estudiante de los materiales necesarios para las clases y responsabilizarnos por los daños morales, materiales o físicos que pudiera ocasionar.",
    ],
  },
  {
    letra: "G",
    titulo: "Autorización de uso de imágenes",
    campo: "carta_g_aceptada_en",
    puntos: [
      "Con la firma del presente formulario, autorizo a la institución a tomar fotografías y videos del/de la estudiante durante el desarrollo de las actividades escolares y de investigación, y a utilizarlos en documentos de seguimiento, sistematización, investigación y difusión institucional, siempre con fines educativos y académicos, y respetando su dignidad (Ley N° 7.593/2025).",
      "Asimismo, manifestamos nuestra conformidad de que, ante el incumplimiento de cualquiera de los compromisos asumidos o de lo establecido en las Normas de Convivencia, respetaremos las medidas y decisiones adoptadas por las instancias institucionales correspondientes, conforme al procedimiento formativo y restaurativo previsto en dichas normas.",
    ],
  },
];

export default function MatriculacionEstudiante({ params }: { params: Promise<{ estudianteId: string }> }) {
  const { estudianteId } = use(params);
  const supabase = createClient();

  const [cargando, setCargando] = useState(true);
  const [habilitado, setHabilitado] = useState(false);
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [ficha, setFicha] = useState<Ficha>(FICHA_VACIA);
  const [personas, setPersonas] = useState<Persona[]>([{ nombre: "", cedula: "", vinculo: "", telefono: "" }]);
  const [paso, setPaso] = useState<"datos" | "carta" | "listo">("datos");
  const [cartaIndex, setCartaIndex] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: familia } = await supabase
      .from("familias")
      .select("id, matriculacion_2027_habilitada, tutor_nombre, tutor_email")
      .eq("tutor_perfil_id", user.id)
      .maybeSingle();

    if (!familia || !familia.matriculacion_2027_habilitada) {
      setHabilitado(false);
      setCargando(false);
      return;
    }

    const { data: est } = await supabase
      .from("estudiantes")
      .select("id, nombre_completo, cedula, familia_id")
      .eq("id", estudianteId)
      .single();

    if (!est || est.familia_id !== familia.id) {
      setHabilitado(false);
      setCargando(false);
      return;
    }

    setHabilitado(true);
    setEstudiante(est);

    const { data: cursosData } = await supabase.from("cursos").select("id, grado, turno, enfasis").order("orden");
    setCursos(cursosData ?? []);

    const { data: fichaData } = await supabase
      .from("fichas_matriculacion")
      .select("*")
      .eq("estudiante_id", estudianteId)
      .eq("anio_lectivo", ANIO_LECTIVO)
      .maybeSingle();

    if (fichaData) {
      setFicha({ ...FICHA_VACIA, ...fichaData });

      const { data: personasData } = await supabase
        .from("personas_autorizadas_retiro")
        .select("nombre, cedula, vinculo, telefono")
        .eq("ficha_id", fichaData.id);
      if (personasData && personasData.length > 0) setPersonas(personasData);

      if (fichaData.completado_en) {
        setPaso("listo");
      } else {
        const primeraPendiente = CARTA_SECCIONES.findIndex((s) => !fichaData[s.campo]);
        if (primeraPendiente === -1) {
          setPaso("listo");
        } else if (fichaData.responsable_nombre) {
          setPaso("carta");
          setCartaIndex(primeraPendiente);
        } else {
          setPaso("datos");
        }
      }
    } else {
      setFicha({
        ...FICHA_VACIA,
        responsable_nombre: familia.tutor_nombre ?? "",
        responsable_correo: familia.tutor_email ?? "",
      });
    }

    setCargando(false);
  }, [estudianteId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  function actualizarFicha<K extends keyof Ficha>(campo: K, valor: Ficha[K]) {
    setFicha((prev) => ({ ...prev, [campo]: valor }));
  }

  function actualizarPersona(index: number, campo: keyof Persona, valor: string) {
    setPersonas((prev) => prev.map((p, i) => (i === index ? { ...p, [campo]: valor } : p)));
  }

  function agregarPersona() {
    setPersonas((prev) => [...prev, { nombre: "", cedula: "", vinculo: "", telefono: "" }]);
  }

  function quitarPersona(index: number) {
    setPersonas((prev) => prev.filter((_, i) => i !== index));
  }

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    if (!ficha.curso_id) {
      setMensaje("Seleccioná el curso al que postula para 2027.");
      return;
    }
    if (!ficha.responsable_nombre.trim() || !ficha.responsable_cedula.trim()) {
      setMensaje("Completá el nombre y la cédula del responsable.");
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const { data: fichaGuardada, error } = await supabase
      .from("fichas_matriculacion")
      .upsert(
        {
          estudiante_id: estudianteId,
          anio_lectivo: ANIO_LECTIVO,
          tramite: ficha.tramite,
          curso_id: ficha.curso_id,
          nacionalidad: ficha.nacionalidad,
          pueblo_indigena: ficha.pueblo_indigena,
          cobertura_medica: ficha.cobertura_medica,
          grupo_sanguineo: ficha.grupo_sanguineo,
          enfermedades_alergias: ficha.enfermedades_alergias,
          discapacidad_apoyo: ficha.discapacidad_apoyo,
          responsable_nombre: ficha.responsable_nombre,
          responsable_cedula: ficha.responsable_cedula,
          responsable_ocupacion: ficha.responsable_ocupacion,
          responsable_vinculo: ficha.responsable_vinculo,
          responsable_vinculo_otro: ficha.responsable_vinculo_otro,
          responsable_telefono: ficha.responsable_telefono,
          responsable_correo: ficha.responsable_correo,
          responsable_direccion: ficha.responsable_direccion,
          segundo_contacto_nombre: ficha.segundo_contacto_nombre,
          segundo_contacto_vinculo: ficha.segundo_contacto_vinculo,
          segundo_contacto_telefono: ficha.segundo_contacto_telefono,
          emergencia_nombre: ficha.emergencia_nombre,
          emergencia_vinculo: ficha.emergencia_vinculo,
          emergencia_telefono: ficha.emergencia_telefono,
        },
        { onConflict: "estudiante_id,anio_lectivo" }
      )
      .select("id")
      .single();

    if (error || !fichaGuardada) {
      setMensaje("No se pudo guardar: " + error?.message);
      setGuardando(false);
      return;
    }

    setFicha((prev) => ({ ...prev, id: fichaGuardada.id }));

    await supabase.from("personas_autorizadas_retiro").delete().eq("ficha_id", fichaGuardada.id);
    const personasValidas = personas.filter((p) => p.nombre.trim());
    if (personasValidas.length > 0) {
      await supabase.from("personas_autorizadas_retiro").insert(
        personasValidas.map((p) => ({
          ficha_id: fichaGuardada.id,
          nombre: p.nombre.trim(),
          cedula: p.cedula.trim() || null,
          vinculo: p.vinculo.trim() || null,
          telefono: p.telefono.trim() || null,
        }))
      );
    }

    setGuardando(false);
    setPaso("carta");
    setCartaIndex(0);
  }

  async function aceptarSeccion() {
    if (!ficha.id) return;
    const seccion = CARTA_SECCIONES[cartaIndex];
    const ahora = new Date().toISOString();
    const esUltima = cartaIndex === CARTA_SECCIONES.length - 1;

    setGuardando(true);
    const payload: Record<string, string> = { [seccion.campo]: ahora };
    if (esUltima) payload.completado_en = ahora;

    const { error } = await supabase.from("fichas_matriculacion").update(payload).eq("id", ficha.id);
    setGuardando(false);

    if (error) {
      setMensaje("No se pudo registrar: " + error.message);
      return;
    }

    setFicha((prev) => ({ ...prev, [seccion.campo]: ahora, ...(esUltima ? { completado_en: ahora } : {}) }));

    if (esUltima) {
      setPaso("listo");
    } else {
      setCartaIndex((i) => i + 1);
    }
  }

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;

  if (!habilitado || !estudiante) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
        Esta sección todavía no está disponible.{" "}
        <Link href="/familia" className="text-teal font-medium">
          Volver a Inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/familia/matriculacion-2027" className="text-xs text-teal font-medium">
          ← Volver a la lista
        </Link>
        <h1 className="font-display text-2xl mt-1">Matriculación 2027 — {estudiante.nombre_completo}</h1>
      </div>

      {paso === "datos" && (
        <form onSubmit={guardarDatos} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold">Trámite y curso</h2>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Trámite
              <select
                value={ficha.tramite}
                onChange={(e) => actualizarFicha("tramite", e.target.value)}
                className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
              >
                <option value="primera_vez">Matriculación (primera vez)</option>
                <option value="confirmacion">Confirmación de matrícula</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Curso al que postula para 2027
              <select
                required
                value={ficha.curso_id}
                onChange={(e) => actualizarFicha("curso_id", e.target.value)}
                className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
              >
                <option value="">Seleccionar…</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.grado} {c.enfasis ? `— ${c.enfasis}` : ""} — Turno {c.turno}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Nacionalidad
              <input value={ficha.nacionalidad} onChange={(e) => actualizarFicha("nacionalidad", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Pueblo indígena (si corresponde)
              <input value={ficha.pueblo_indigena} onChange={(e) => actualizarFicha("pueblo_indigena", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
            </label>
          </section>

          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <h2 className="text-sm font-bold">Salud y necesidades de apoyo</h2>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Cobertura médica
              <select
                value={ficha.cobertura_medica}
                onChange={(e) => actualizarFicha("cobertura_medica", e.target.value)}
                className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
              >
                <option value="ips">IPS</option>
                <option value="privado">Seguro privado</option>
                <option value="ninguna">Ninguna</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Grupo sanguíneo
              <input value={ficha.grupo_sanguineo} onChange={(e) => actualizarFicha("grupo_sanguineo", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card max-w-xs" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Enfermedades, alergias o medicación habitual
              <textarea
                value={ficha.enfermedades_alergias}
                onChange={(e) => actualizarFicha("enfermedades_alergias", e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm bg-card min-h-20"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Discapacidad o necesidad específica de apoyo educativo
              <textarea
                value={ficha.discapacidad_apoyo}
                onChange={(e) => actualizarFicha("discapacidad_apoyo", e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm bg-card min-h-20"
              />
            </label>
          </section>

          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <h2 className="text-sm font-bold">Datos del responsable y contactos</h2>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Nombre y apellido del responsable
              <input required value={ficha.responsable_nombre} onChange={(e) => actualizarFicha("responsable_nombre", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Cédula del responsable
              <input required value={ficha.responsable_cedula} onChange={(e) => actualizarFicha("responsable_cedula", e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="h-11 rounded-lg border border-border px-3 text-sm bg-card max-w-xs" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Ocupación
              <input value={ficha.responsable_ocupacion} onChange={(e) => actualizarFicha("responsable_ocupacion", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Vínculo con el/la estudiante
              <select
                value={ficha.responsable_vinculo}
                onChange={(e) => actualizarFicha("responsable_vinculo", e.target.value)}
                className="h-11 rounded-lg border border-border px-3 text-sm bg-card max-w-xs"
              >
                <option value="padre">Padre</option>
                <option value="madre">Madre</option>
                <option value="tutor">Tutor/a</option>
                <option value="encargado">Encargado/a</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            {ficha.responsable_vinculo === "otro" && (
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Especificar vínculo
                <input value={ficha.responsable_vinculo_otro} onChange={(e) => actualizarFicha("responsable_vinculo_otro", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Teléfono / WhatsApp
              <input value={ficha.responsable_telefono} onChange={(e) => actualizarFicha("responsable_telefono", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card max-w-xs" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Correo electrónico
              <input type="email" value={ficha.responsable_correo} onChange={(e) => actualizarFicha("responsable_correo", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Dirección
              <input value={ficha.responsable_direccion} onChange={(e) => actualizarFicha("responsable_direccion", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
            </label>

            <div className="grid sm:grid-cols-3 gap-3 bg-bg rounded-lg p-3">
              <span className="text-[13px] font-semibold sm:col-span-3">Segundo contacto (opcional)</span>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Nombre y apellido
                <input value={ficha.segundo_contacto_nombre} onChange={(e) => actualizarFicha("segundo_contacto_nombre", e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Vínculo
                <input value={ficha.segundo_contacto_vinculo} onChange={(e) => actualizarFicha("segundo_contacto_vinculo", e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Teléfono
                <input value={ficha.segundo_contacto_telefono} onChange={(e) => actualizarFicha("segundo_contacto_telefono", e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
              </label>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 bg-bg rounded-lg p-3">
              <span className="text-[13px] font-semibold sm:col-span-3">Contacto en caso de emergencia, si es otra persona (opcional)</span>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Nombre y apellido
                <input value={ficha.emergencia_nombre} onChange={(e) => actualizarFicha("emergencia_nombre", e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Vínculo
                <input value={ficha.emergencia_vinculo} onChange={(e) => actualizarFicha("emergencia_vinculo", e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Teléfono
                <input value={ficha.emergencia_telefono} onChange={(e) => actualizarFicha("emergencia_telefono", e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
              </label>
            </div>
          </section>

          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <h2 className="text-sm font-bold">Personas autorizadas a retirar al/a la estudiante</h2>
            {personas.map((p, i) => (
              <div key={i} className="grid sm:grid-cols-5 gap-2 items-end bg-bg rounded-lg p-3">
                <label className="flex flex-col gap-1 text-[12.5px] font-medium sm:col-span-2">
                  Nombre y apellido
                  <input value={p.nombre} onChange={(e) => actualizarPersona(i, "nombre", e.target.value)} className="h-9 rounded-md border border-border px-2.5 text-sm bg-card" />
                </label>
                <label className="flex flex-col gap-1 text-[12.5px] font-medium">
                  Cédula
                  <input value={p.cedula} onChange={(e) => actualizarPersona(i, "cedula", e.target.value)} className="h-9 rounded-md border border-border px-2.5 text-sm bg-card" />
                </label>
                <label className="flex flex-col gap-1 text-[12.5px] font-medium">
                  Vínculo
                  <input value={p.vinculo} onChange={(e) => actualizarPersona(i, "vinculo", e.target.value)} className="h-9 rounded-md border border-border px-2.5 text-sm bg-card" />
                </label>
                <div className="flex gap-2 items-end">
                  <label className="flex flex-col gap-1 text-[12.5px] font-medium flex-1">
                    Teléfono
                    <input value={p.telefono} onChange={(e) => actualizarPersona(i, "telefono", e.target.value)} className="h-9 rounded-md border border-border px-2.5 text-sm bg-card" />
                  </label>
                  {personas.length > 1 && (
                    <button type="button" onClick={() => quitarPersona(i)} className="h-9 px-2 text-base">
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={agregarPersona} className="text-xs text-teal font-medium self-start">
              + Agregar otra persona autorizada
            </button>
          </section>

          {mensaje && <div className="text-sm text-text-soft bg-bg rounded-lg px-3 py-2">{mensaje}</div>}

          <button disabled={guardando} className="h-11 rounded-lg bg-navy text-white font-semibold text-sm w-fit px-6">
            {guardando ? "Guardando…" : "Guardar y continuar con la Carta de Compromiso"}
          </button>
        </form>
      )}

      {paso === "carta" && (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-soft">
              Punto {cartaIndex + 1} de {CARTA_SECCIONES.length}
            </span>
            <button type="button" onClick={() => setPaso("datos")} className="text-xs text-teal font-medium">
              ← Editar mis datos
            </button>
          </div>

          {cartaIndex === 0 && (
            <p className="text-sm bg-bg rounded-lg p-3">
              Yo, <strong>{ficha.responsable_nombre || "—"}</strong>, con C.I. N° <strong>{ficha.responsable_cedula || "—"}</strong>, en
              calidad de {ficha.responsable_vinculo === "otro" ? ficha.responsable_vinculo_otro || "—" : ficha.responsable_vinculo}, del/de
              la estudiante <strong>{estudiante.nombre_completo}</strong>, con C.I. N° <strong>{estudiante.cedula ?? "—"}</strong>, declaro
              haber recibido y conocer las Normas de Convivencia del Colegio Nacional Mariano Roque Alonso y, junto con mi hijo/a o
              representado/a, nos comprometemos a lo siguiente.
            </p>
          )}

          <div>
            <h2 className="text-sm font-bold">
              {CARTA_SECCIONES[cartaIndex].letra}. {CARTA_SECCIONES[cartaIndex].titulo}
            </h2>
            <ul className="list-disc pl-5 mt-2 flex flex-col gap-2 text-sm">
              {CARTA_SECCIONES[cartaIndex].puntos.map((punto, i) => (
                <li key={i}>{punto}</li>
              ))}
            </ul>
          </div>

          {mensaje && <div className="text-sm text-danger">{mensaje}</div>}

          <button
            type="button"
            disabled={guardando}
            onClick={aceptarSeccion}
            className="h-11 rounded-lg bg-navy text-white font-semibold text-sm w-fit px-6 disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Lo he leído, lo comprendo y lo acepto"}
          </button>
        </div>
      )}

      {paso === "listo" && (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <p className="text-sm">
            Completaste los datos y aceptaste los {CARTA_SECCIONES.length} puntos de la Carta de Compromiso para{" "}
            <strong>{estudiante.nombre_completo}</strong>. Ahora generá el documento, imprimilo, firmalo y entregalo en la institución.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/familia/matriculacion-2027/${estudianteId}/imprimir`}
              className="h-11 rounded-lg bg-navy text-white font-semibold text-sm px-6 flex items-center justify-center"
            >
              Ver documento para imprimir
            </Link>
            <button type="button" onClick={() => setPaso("datos")} className="h-11 rounded-lg border border-border font-semibold text-sm px-6">
              Editar mis datos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
</parameter>
</invoke>
