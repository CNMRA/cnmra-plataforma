"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ANIO_LECTIVO = 2027;

type Curso = { id: string; grado: string; turno: string; enfasis: string | null };
type Estudiante = { id: string; nombre_completo: string; cedula: string | null; familia_id: string | null };
type Responsable = {
  nombre: string;
  cedula: string;
  vinculo: string;
  telefono: string;
  direccion: string;
  ocupacion: string;
  correo: string;
};

type FichaDB = {
  id: string;
  estudiante_id: string;
  anio_lectivo: number;
  tramite: string | null;
  curso_id: string | null;
  nacionalidad: string | null;
  pueblo_indigena: string | null;
  cobertura_medica: string | null;
  grupo_sanguineo: string | null;
  enfermedades_alergias: string | null;
  discapacidad_apoyo: string | null;
  responsable_nombre: string | null;
  responsable_cedula: string | null;
  responsable_vinculo: string | null;
  responsable_telefono: string | null;
  responsable_direccion: string | null;
  emergencia_nombre: string | null;
  emergencia_vinculo: string | null;
  emergencia_telefono: string | null;
  carta_a_aceptada_en: string | null;
  carta_b_aceptada_en: string | null;
  carta_c_aceptada_en: string | null;
  carta_d_aceptada_en: string | null;
  carta_e_aceptada_en: string | null;
  carta_f_aceptada_en: string | null;
  carta_g_aceptada_en: string | null;
  completado_en: string | null;
  confirmacion_final_en: string | null;
};

type Seccion = { letra: string; titulo: string; puntos: string[] };

const SECCIONES_CARTA: Seccion[] = [
  {
    letra: "A",
    titulo: "Convivencia, acompañamiento y comunicación",
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
    puntos: [
      "Asegurar la asistencia regular y puntual, con llegada 10 minutos antes del inicio para la formación general, y la permanencia del/de la estudiante durante toda la jornada.",
      "Justificar toda ausencia dentro de las 24 horas, sabiendo que tres llegadas tardías equivalen a un día de ausencia y que las ausencias en días de examen deben justificarse el mismo día.",
      "Retirar anticipadamente al/a la estudiante solo de forma personal, registrando la salida en Secretaría. No se aceptarán retiros por llamada telefónica.",
    ],
  },
  {
    letra: "C",
    titulo: "Uniforme y presentación personal",
    puntos: [
      "Garantizar que el/la estudiante asista todos los días con el uniforme completo que corresponda (diario, de gala o de Educación Física) y con una presentación personal adecuada.",
      "Si el/la estudiante se presenta sin uniforme, no se le permitirá el acceso a clases. La institución comunicará de inmediato a la familia, que deberá acercar el uniforme o retirar personalmente al/a la estudiante; mientras tanto, permanecerá bajo el cuidado de un adulto de la institución. Solo se considerarán las situaciones excepcionales comunicadas y justificadas previamente ante la Dirección.",
      "No utilizar el uniforme fuera del horario y de las actividades escolares, por tratarse de la imagen de la institución.",
    ],
  },
  {
    letra: "D",
    titulo: "Celulares y aparatos electrónicos",
    puntos: [
      "No enviar al/a la estudiante con celular ni con otros aparatos electrónicos personales (tablets, relojes inteligentes, auriculares, etc.). Ante una emergencia, la familia y el/la estudiante se comunicarán a través del teléfono de la Secretaría o Dirección de turno.",
      "En casos excepcionales (salud, discapacidad o estudiante trabajador/a) autorizados por escrito por la Dirección, el dispositivo deberá entregarse apagado al inicio de la jornada y se devolverá al finalizarla. Todo aparato retenido por incumplimiento será devuelto únicamente al padre, la madre o el tutor/a. La institución no se responsabiliza por pérdida o daño de dispositivos.",
      "No fotografiar, filmar, grabar ni difundir imágenes de compañeros/as, docentes o personal de la institución sin su consentimiento (Ley N° 7.593/2025).",
    ],
  },
  {
    letra: "E",
    titulo: "Limpieza y cuidado de los espacios",
    puntos: [
      "Colaborar activamente con la limpieza y el orden de todos los espacios de uso estudiantil —aulas, patio, sanitarios, pasillos, biblioteca, laboratorios y cantina— según el cronograma organizado por el/la profesor/a guía, y dejar el aula limpia y ordenada al terminar la jornada.",
      "Arrojar los residuos en los basureros, hacer un uso higiénico de los sanitarios y cuidar el agua, la luz y las instalaciones.",
      "Cuidar el mobiliario y los bienes de la institución. En caso de daño deliberado o por negligencia, la familia asumirá su reparación o reposición (Normas de Convivencia, punto 7.5).",
    ],
  },
  {
    letra: "F",
    titulo: "Seguridad y responsabilidad",
    puntos: [
      "No portar armas, objetos peligrosos, bebidas alcohólicas, cigarrillos, vapeadores ni sustancias prohibidas, y aceptar los protocolos de seguridad institucional, incluida la revisión de mochilas (Res. MEC N° 183/2023 y N° 845/2023).",
      "Proveer al/a la estudiante de los materiales necesarios para las clases y responsabilizarnos por los daños morales, materiales o físicos que pudiera ocasionar.",
    ],
  },
  {
    letra: "G",
    titulo: "Autorización de uso de imágenes",
    puntos: [
      "Con la firma del presente formulario, autorizo a la institución a tomar fotografías y videos del/de la estudiante durante el desarrollo de las actividades escolares, y a utilizarlos en documentos de seguimiento, sistematización y difusión institucional, siempre con fines educativos y académicos, y respetando su dignidad (Ley N° 7.593/2025).",
      "Asimismo, manifestamos nuestra conformidad de que, ante el incumplimiento de cualquiera de los compromisos asumidos o de lo establecido en las Normas de Convivencia, respetaremos las medidas y decisiones adoptadas por las instancias institucionales correspondientes, conforme al procedimiento formativo y restaurativo previsto en dichas normas.",
    ],
  },
];

const CAMPO_POR_LETRA: Record<string, keyof FichaDB> = {
  A: "carta_a_aceptada_en",
  B: "carta_b_aceptada_en",
  C: "carta_c_aceptada_en",
  D: "carta_d_aceptada_en",
  E: "carta_e_aceptada_en",
  F: "carta_f_aceptada_en",
  G: "carta_g_aceptada_en",
};

function responsableVacio(): Responsable {
  return { nombre: "", cedula: "", vinculo: "", telefono: "", direccion: "", ocupacion: "", correo: "" };
}

export default function Matriculacion2027Wizard({ params }: { params: Promise<{ estudianteId: string }> }) {
  const { estudianteId } = use(params);
  const supabase = createClient();

  const [cargando, setCargando] = useState(true);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [ficha, setFicha] = useState<FichaDB | null>(null);
  const [responsables, setResponsables] = useState<Responsable[]>([responsableVacio()]);
  const [mostrarEmergencia, setMostrarEmergencia] = useState(false);
  const [paso, setPaso] = useState<"datos" | "carta" | "listo">("datos");
  const [cartaIndex, setCartaIndex] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [tramite, setTramite] = useState("");
  const [cursoId, setCursoId] = useState("");
  const [nacionalidad, setNacionalidad] = useState("Paraguaya");
  const [puebloIndigena, setPuebloIndigena] = useState("");
  const [coberturaMedica, setCoberturaMedica] = useState("");
  const [grupoSanguineo, setGrupoSanguineo] = useState("");
  const [enfermedades, setEnfermedades] = useState("");
  const [discapacidad, setDiscapacidad] = useState("");
  const [emerNombre, setEmerNombre] = useState("");
  const [emerVinculo, setEmerVinculo] = useState("");
  const [emerTelefono, setEmerTelefono] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: familia } = await supabase
      .from("familias")
      .select("id, matriculacion_2027_habilitada")
      .eq("tutor_perfil_id", user.id)
      .maybeSingle();

    const { data: est } = await supabase
      .from("estudiantes")
      .select("id, nombre_completo, cedula, familia_id")
      .eq("id", estudianteId)
      .maybeSingle();

    if (!familia || !familia.matriculacion_2027_habilitada || !est || est.familia_id !== familia.id) {
      setSinAcceso(true);
      setCargando(false);
      return;
    }

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
      const f = fichaData as FichaDB;
      setFicha(f);
      setTramite(f.tramite ?? "");
      setCursoId(f.curso_id ?? "");
      setNacionalidad(f.nacionalidad ?? "Paraguaya");
      setPuebloIndigena(f.pueblo_indigena ?? "");
      setCoberturaMedica(f.cobertura_medica ?? "");
      setGrupoSanguineo(f.grupo_sanguineo ?? "");
      setEnfermedades(f.enfermedades_alergias ?? "");
      setDiscapacidad(f.discapacidad_apoyo ?? "");

      if (f.emergencia_nombre) {
        setMostrarEmergencia(true);
        setEmerNombre(f.emergencia_nombre ?? "");
        setEmerVinculo(f.emergencia_vinculo ?? "");
        setEmerTelefono(f.emergencia_telefono ?? "");
      }

      const { data: responsablesData } = await supabase
        .from("responsables_matriculacion")
        .select("nombre, cedula, vinculo, telefono, direccion, ocupacion, correo")
        .eq("ficha_id", f.id)
        .order("orden");

      setResponsables(
        responsablesData && responsablesData.length > 0
          ? responsablesData.map((r) => ({
              nombre: r.nombre,
              cedula: r.cedula,
              vinculo: r.vinculo,
              telefono: r.telefono,
              direccion: r.direccion,
              ocupacion: r.ocupacion ?? "",
              correo: r.correo ?? "",
            }))
          : [responsableVacio()]
      );

      if (f.completado_en) {
        setPaso("listo");
      } else {
        const primeraSinAceptar = SECCIONES_CARTA.findIndex((s) => !f[CAMPO_POR_LETRA[s.letra]]);
        setPaso("carta");
        setCartaIndex(primeraSinAceptar === -1 ? SECCIONES_CARTA.length - 1 : primeraSinAceptar);
      }
    }

    setCargando(false);
  }, [estudianteId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos desde Supabase
    cargar();
  }, [cargar]);

  function actualizarResponsable(i: number, campo: keyof Responsable, valor: string) {
    setResponsables((prev) => prev.map((r, idx) => (idx === i ? { ...r, [campo]: valor } : r)));
  }

  function agregarResponsable() {
    setResponsables((prev) => [...prev, responsableVacio()]);
  }

  function quitarResponsable(i: number) {
    setResponsables((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    if (!tramite) {
      setMensaje("Seleccioná el tipo de trámite.");
      return;
    }
    if (!cursoId) {
      setMensaje("Seleccioná el grado/curso y turno para 2027.");
      return;
    }
    const incompleto = responsables.some(
      (r) => !r.nombre.trim() || !r.cedula.trim() || !r.vinculo || !r.telefono.trim() || !r.direccion.trim()
    );
    if (incompleto) {
      setMensaje("Completá nombre, cédula, vínculo, teléfono y dirección de cada responsable que agregaste.");
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const principal = responsables[0];

    const { data: fichaGuardada, error } = await supabase
      .from("fichas_matriculacion")
      .upsert(
        {
          estudiante_id: estudianteId,
          anio_lectivo: ANIO_LECTIVO,
          tramite,
          curso_id: cursoId,
          nacionalidad: nacionalidad.trim() || null,
          pueblo_indigena: puebloIndigena.trim() || null,
          cobertura_medica: coberturaMedica || null,
          grupo_sanguineo: grupoSanguineo.trim() || null,
          enfermedades_alergias: enfermedades.trim() || null,
          discapacidad_apoyo: discapacidad.trim() || null,
          responsable_nombre: principal.nombre.trim(),
          responsable_cedula: principal.cedula.trim(),
          responsable_vinculo: principal.vinculo,
          responsable_telefono: principal.telefono.trim(),
          responsable_direccion: principal.direccion.trim(),
          emergencia_nombre: mostrarEmergencia ? emerNombre.trim() || null : null,
          emergencia_vinculo: mostrarEmergencia ? emerVinculo.trim() || null : null,
          emergencia_telefono: mostrarEmergencia ? emerTelefono.trim() || null : null,
        },
        { onConflict: "estudiante_id,anio_lectivo" }
      )
      .select("*")
      .single();

    if (error || !fichaGuardada) {
      setMensaje("No se pudo guardar: " + error?.message);
      setGuardando(false);
      return;
    }

    const f = fichaGuardada as FichaDB;
    setFicha(f);

    await supabase.from("responsables_matriculacion").delete().eq("ficha_id", f.id);
    await supabase.from("responsables_matriculacion").insert(
      responsables.map((r, i) => ({
        ficha_id: f.id,
        orden: i,
        nombre: r.nombre.trim(),
        cedula: r.cedula.trim(),
        vinculo: r.vinculo,
        telefono: r.telefono.trim(),
        direccion: r.direccion.trim(),
        ocupacion: r.ocupacion.trim() || null,
        correo: r.correo.trim() || null,
      }))
    );

    // Crea la inscripción pendiente para 2027 si todavía no existe, así aparece
    // en el panel de la institución para que le asignen sección y la matriculen.
    const { data: inscripcionExistente } = await supabase
      .from("inscripciones")
      .select("id")
      .eq("estudiante_id", estudianteId)
      .eq("anio_lectivo", ANIO_LECTIVO)
      .maybeSingle();

    if (!inscripcionExistente) {
      await supabase.from("inscripciones").insert({
        estudiante_id: estudianteId,
        curso_solicitado_id: cursoId || null,
        anio_lectivo: ANIO_LECTIVO,
        estado: "pendiente",
      });
    }

    setGuardando(false);
    const primeraSinAceptar = SECCIONES_CARTA.findIndex((s) => !f[CAMPO_POR_LETRA[s.letra]]);
    setCartaIndex(primeraSinAceptar === -1 ? 0 : primeraSinAceptar);
    setPaso("carta");
  }

  async function aceptarSeccion() {
    if (!ficha) return;
    setGuardando(true);
    const letra = SECCIONES_CARTA[cartaIndex].letra;
    const campo = CAMPO_POR_LETRA[letra];
    const ahora = new Date().toISOString();
    const esUltima = cartaIndex === SECCIONES_CARTA.length - 1;

    const payload: Record<string, string> = { [campo]: ahora };
    if (esUltima) payload.completado_en = ahora;

    const { data, error } = await supabase
      .from("fichas_matriculacion")
      .update(payload)
      .eq("id", ficha.id)
      .select("*")
      .single();

    setGuardando(false);
    if (error || !data) {
      setMensaje("No se pudo guardar la aceptación: " + error?.message);
      return;
    }

    setFicha(data as FichaDB);

    if (esUltima) {
      setPaso("listo");
    } else {
      setCartaIndex((i) => i + 1);
    }
  }

  if (cargando) return <p className="text-sm text-text-soft">Cargando…</p>;

  if (sinAcceso) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
        No tenés acceso a esta pantalla.{" "}
        <Link href="/familia" className="text-teal font-medium">
          Volver a Inicio
        </Link>
      </div>
    );
  }

  const cursoElegido = cursos.find((c) => c.id === cursoId);
  const principal = responsables[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/familia/matriculacion-2027" className="text-xs text-teal font-medium">
          ← Volver a la lista
        </Link>
        <h1 className="font-display text-2xl mt-1">Matriculación 2027 — {estudiante?.nombre_completo}</h1>
      </div>

      {paso === "datos" && (
        <form onSubmit={guardarDatos} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5">
          <div>
            <h2 className="font-semibold text-sm mb-2">Trámite</h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="tramite" checked={tramite === "primera_vez"} onChange={() => setTramite("primera_vez")} />
                Matriculación (primera vez)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="tramite" checked={tramite === "confirmacion"} onChange={() => setTramite("confirmacion")} />
                Confirmación de matrícula
              </label>
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Grado/Curso 2027 y turno
            <select required value={cursoId} onChange={(e) => setCursoId(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card">
              <option value="">Seleccionar…</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grado} {c.enfasis ? `— ${c.enfasis}` : ""} — Turno {c.turno}
                </option>
              ))}
            </select>
          </label>

          <div className="border-t border-border pt-4">
            <h2 className="font-semibold text-sm mb-3">II. Salud y necesidades de apoyo</h2>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Cobertura médica
                <select value={coberturaMedica} onChange={(e) => setCoberturaMedica(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card max-w-xs">
                  <option value="">Seleccionar…</option>
                  <option value="ips">IPS</option>
                  <option value="privado">Seguro privado</option>
                  <option value="ninguna">Ninguna</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Grupo sanguíneo (si lo sabe)
                <input value={grupoSanguineo} onChange={(e) => setGrupoSanguineo(e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card max-w-xs" />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Enfermedades, alergias o medicación habitual
                <textarea value={enfermedades} onChange={(e) => setEnfermedades(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm bg-card min-h-16" />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Discapacidad o necesidad específica de apoyo educativo (si corresponde)
                <textarea value={discapacidad} onChange={(e) => setDiscapacidad(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm bg-card min-h-16" />
              </label>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h2 className="font-semibold text-sm mb-1">III. Datos de la madre, el padre y/o el responsable</h2>
            <p className="text-xs text-text-soft mb-3">Completá al menos uno. Si el/la estudiante no vive con uno de los dos, simplemente no lo agregues.</p>
            <div className="flex flex-col gap-4">
              {responsables.map((r, i) => (
                <div key={i} className="bg-bg rounded-lg p-4 flex flex-col gap-3">
                  {i > 0 && (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => quitarResponsable(i)} className="text-xs text-danger font-semibold">
                        Quitar
                      </button>
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                      Vínculo con el/la estudiante
                      <select
                        required
                        value={r.vinculo}
                        onChange={(e) => actualizarResponsable(i, "vinculo", e.target.value)}
                        className="h-11 rounded-lg border border-border px-3 text-sm bg-card"
                      >
                        <option value="">Seleccionar…</option>
                        <option value="padre">Padre</option>
                        <option value="madre">Madre</option>
                        <option value="responsable">Responsable</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                      Nombre y apellido
                      <input required value={r.nombre} onChange={(e) => actualizarResponsable(i, "nombre", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                      C.I. N°
                      <input required value={r.cedula} onChange={(e) => actualizarResponsable(i, "cedula", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                      Teléfono/WhatsApp
                      <input required value={r.telefono} onChange={(e) => actualizarResponsable(i, "telefono", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium sm:col-span-2">
                      Dirección
                      <input required value={r.direccion} onChange={(e) => actualizarResponsable(i, "direccion", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                      Ocupación (opcional)
                      <input value={r.ocupacion} onChange={(e) => actualizarResponsable(i, "ocupacion", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                      Correo electrónico (opcional)
                      <input type="email" value={r.correo} onChange={(e) => actualizarResponsable(i, "correo", e.target.value)} className="h-11 rounded-lg border border-border px-3 text-sm bg-card" />
                    </label>
                  </div>
                </div>
              ))}
              <button type="button" onClick={agregarResponsable} className="text-xs text-teal font-medium self-start">
                + Agregar otro responsable
              </button>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            {!mostrarEmergencia ? (
              <button type="button" onClick={() => setMostrarEmergencia(true)} className="text-xs text-teal font-medium">
                + Agregar contacto de emergencia (opcional)
              </button>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-sm">Contacto de emergencia (opcional)</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarEmergencia(false);
                      setEmerNombre("");
                      setEmerVinculo("");
                      setEmerTelefono("");
                    }}
                    className="text-xs text-danger font-semibold"
                  >
                    Quitar
                  </button>
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  <input placeholder="Nombre y apellido" value={emerNombre} onChange={(e) => setEmerNombre(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
                  <input placeholder="Vínculo" value={emerVinculo} onChange={(e) => setEmerVinculo(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
                  <input placeholder="Teléfono" value={emerTelefono} onChange={(e) => setEmerTelefono(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm bg-card" />
                </div>
              </>
            )}
          </div>

          {mensaje && <div className="text-sm text-text-soft bg-bg rounded-lg px-3 py-2">{mensaje}</div>}

          <button disabled={guardando} className="h-11 rounded-lg bg-navy text-white font-semibold text-sm w-fit px-6 disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar y continuar a la Carta de Compromiso"}
          </button>
        </form>
      )}

      {paso === "carta" && ficha && (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-soft uppercase tracking-wide">
              Carta de Compromiso — {cartaIndex + 1} de {SECCIONES_CARTA.length}
            </span>
            <button type="button" onClick={() => setPaso("datos")} className="text-xs text-teal font-medium">
              ← Editar mis datos
            </button>
          </div>

          {cartaIndex === 0 && principal && (
            <div className="bg-bg rounded-lg p-4 text-sm leading-relaxed">
              Señor/a Director/a: Yo, <strong>{principal.nombre || "____________________"}</strong>, con C.I. N°{" "}
              <strong>{principal.cedula || "____________"}</strong>, en calidad de{" "}
              <strong>
                {principal.vinculo === "padre" ? "Padre" : principal.vinculo === "madre" ? "Madre" : principal.vinculo === "responsable" ? "Responsable" : "—"}
              </strong>{" "}
              del/de la estudiante <strong>{estudiante?.nombre_completo}</strong>, con C.I. N°{" "}
              <strong>{estudiante?.cedula ?? "—"}</strong>, matriculado/a en el{" "}
              <strong>
                {cursoElegido ? `${cursoElegido.grado}${cursoElegido.enfasis ? ` — ${cursoElegido.enfasis}` : ""}` : "—"}
              </strong>
              , turno <strong>{cursoElegido?.turno ?? "—"}</strong>, declaro haber recibido y conocer las Normas de
              Convivencia del Colegio Nacional Mariano Roque Alonso y, junto con mi hijo/a o representado/a, nos
              comprometemos a:
            </div>
          )}

          <div>
            <h2 className="font-display text-xl mb-3">
              {SECCIONES_CARTA[cartaIndex].letra}. {SECCIONES_CARTA[cartaIndex].titulo}
            </h2>
            <ul className="flex flex-col gap-3 list-disc pl-5 text-sm leading-relaxed">
              {SECCIONES_CARTA[cartaIndex].puntos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>

          {mensaje && <div className="text-sm text-text-soft bg-bg rounded-lg px-3 py-2">{mensaje}</div>}

          <button
            onClick={aceptarSeccion}
            disabled={guardando}
            className="h-11 rounded-lg bg-navy text-white font-semibold text-sm w-fit px-6 disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Lo he leído, lo comprendo y lo acepto"}
          </button>
        </div>
      )}

      {paso === "listo" && (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <p className="text-sm">
            Completaste los datos y aceptaste los 7 puntos de la Carta de Compromiso para {estudiante?.nombre_completo}.
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
