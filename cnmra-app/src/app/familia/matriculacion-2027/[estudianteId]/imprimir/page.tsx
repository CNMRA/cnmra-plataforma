import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BotonImprimir from "@/components/BotonImprimir";
import ConfirmarCompromiso from "@/components/ConfirmarCompromiso";

const ANIO_LECTIVO = 2027;

type Seccion = { letra: string; titulo: string; puntos: string[]; campo: string };
type Responsable = { nombre: string; cedula: string; vinculo: string; telefono: string; direccion: string; ocupacion: string | null; correo: string | null };

const SECCIONES_CARTA: Seccion[] = [
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
      "Retirar anticipadamente al/a la estudiante solo de forma personal, registrando la salida en Secretaría. No se aceptarán retiros por llamada telefónica.",
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
      "Con la firma del presente formulario, autorizo a la institución a tomar fotografías y videos del/de la estudiante durante el desarrollo de las actividades escolares, y a utilizarlos en documentos de seguimiento, sistematización y difusión institucional, siempre con fines educativos y académicos, y respetando su dignidad (Ley N° 7.593/2025).",
      "Asimismo, manifestamos nuestra conformidad de que, ante el incumplimiento de cualquiera de los compromisos asumidos o de lo establecido en las Normas de Convivencia, respetaremos las medidas y decisiones adoptadas por las instancias institucionales correspondientes, conforme al procedimiento formativo y restaurativo previsto en dichas normas.",
    ],
  },
];

function formatearFecha(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function etiquetaVinculo(v: string) {
  switch (v) {
    case "padre":
      return "Padre";
    case "madre":
      return "Madre";
    case "responsable":
      return "Responsable";
    default:
      return v || "—";
  }
}

export default async function Matriculacion2027Imprimir({ params }: { params: Promise<{ estudianteId: string }> }) {
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

  if (!familia || !familia.matriculacion_2027_habilitada || !estudiante || estudiante.familia_id !== familia.id) {
    notFound();
  }

  const { data: ficha } = await supabase
    .from("fichas_matriculacion")
    .select("*")
    .eq("estudiante_id", estudianteId)
    .eq("anio_lectivo", ANIO_LECTIVO)
    .maybeSingle();

  if (!ficha || !ficha.completado_en) {
    notFound();
  }

  if (!ficha.confirmacion_final_en) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-5">
        <ConfirmarCompromiso
          fichaId={ficha.id}
          estudianteNombre={estudiante!.nombre_completo}
          volverHref={`/familia/matriculacion-2027/${estudianteId}`}
        />
      </div>
    );
  }

  const { data: curso } = ficha.curso_id
    ? await supabase.from("cursos").select("grado, turno, enfasis").eq("id", ficha.curso_id).maybeSingle()
    : { data: null };

  const { data: responsablesData } = await supabase
    .from("responsables_matriculacion")
    .select("nombre, cedula, vinculo, telefono, direccion, ocupacion, correo")
    .eq("ficha_id", ficha.id)
    .order("orden");

  const responsables: Responsable[] = responsablesData && responsablesData.length > 0
    ? responsablesData
    : [
        {
          nombre: ficha.responsable_nombre ?? "—",
          cedula: ficha.responsable_cedula ?? "—",
          vinculo: ficha.responsable_vinculo ?? "",
          telefono: ficha.responsable_telefono ?? "—",
          direccion: ficha.responsable_direccion ?? "—",
          ocupacion: null,
          correo: null,
        },
      ];

  const sujeto = responsables.length > 1 ? "Nosotros" : "Yo";
  const nombres = responsables.map((r) => r.nombre).join(" y ");
  const cedulas = responsables.map((r) => r.cedula).join(" y ");
  const vinculos = responsables.map((r) => etiquetaVinculo(r.vinculo)).join(" y ");

  return (
    <div className="bg-white text-[#141413]">
      <style>{`
        @media print {
          .no-imprimir { display: none !important; }
          body { background: #fff; }
          @page { margin: 18mm 15mm; }
        }
        .doc { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; font-size: 12.5px; line-height: 1.5; max-width: 820px; margin: 0 auto; padding: 24px 20px 60px; }
        .doc h1 { font-size: 16px; margin: 0; }
        .doc h2 { font-size: 13.5px; margin: 18px 0 8px; border-bottom: 1px solid #141413; padding-bottom: 3px; }
        .doc table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
        .doc td { padding: 3px 6px; vertical-align: top; }
        .doc .campo { color: #4A4A47; width: 190px; }
        .doc .firma { margin-top: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .doc .linea { border-top: 1px solid #141413; margin-top: 46px; padding-top: 4px; font-size: 11px; text-align: center; }
        .doc .aceptado { font-size: 11px; color: #1E7A47; font-weight: 600; margin-top: 6px; }
        .doc ul { margin: 6px 0; padding-left: 20px; }
        .doc li { margin-bottom: 5px; }
        .doc .bloque-responsable { margin-bottom: 10px; }
        .doc .bloque-responsable .etiqueta { font-weight: 600; margin-bottom: 2px; }
        .doc .confirmacion-final { background: #E6F4EC; border: 1px solid #BFE3CB; border-radius: 8px; padding: 10px 14px; margin: 16px 0; font-size: 12px; font-weight: 600; color: #1E7A47; }
      `}</style>

      <div className="no-imprimir sticky top-0 bg-[#F7F7F5] border-b border-[#E5E3DD] px-5 py-3 flex items-center justify-between">
        <a href={`/familia/matriculacion-2027/${estudianteId}`} className="text-sm text-teal font-medium">
          ← Volver
        </a>
        <BotonImprimir />
      </div>

      <div className="doc">
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h1>COLEGIO NACIONAL MARIANO ROQUE ALONSO</h1>
          <div style={{ fontSize: 11, color: "#4A4A47", marginTop: 2 }}>
            Código Institucional 27534 · Área Educativa 11-55 · Departamento Central
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>
            FICHA INDIVIDUAL DE MATRICULACIÓN DEL/DE LA ESTUDIANTE — AÑO LECTIVO 2027
          </div>
        </div>

        <h2>I. Datos del/de la estudiante</h2>
        <table>
          <tr>
            <td className="campo">Trámite</td>
            <td>{ficha.tramite === "primera_vez" ? "Matriculación (primera vez)" : "Confirmación de matrícula"}</td>
          </tr>
          <tr>
            <td className="campo">Nombre y apellido</td>
            <td>{estudiante!.nombre_completo}</td>
          </tr>
          <tr>
            <td className="campo">Cédula de identidad</td>
            <td>{estudiante!.cedula ?? "—"}</td>
          </tr>
          <tr>
            <td className="campo">Grado/Curso y turno 2027</td>
            <td>{curso ? `${curso.grado}${curso.enfasis ? ` — ${curso.enfasis}` : ""} — Turno ${curso.turno}` : "—"}</td>
          </tr>
          <tr>
            <td className="campo">Nacionalidad</td>
            <td>{ficha.nacionalidad ?? "—"}</td>
          </tr>
          <tr>
            <td className="campo">Pueblo indígena</td>
            <td>{ficha.pueblo_indigena ?? "—"}</td>
          </tr>
        </table>

        <h2>II. Salud y necesidades de apoyo</h2>
        <table>
          <tr>
            <td className="campo">Cobertura médica</td>
            <td>
              {ficha.cobertura_medica === "ips" ? "IPS" : ficha.cobertura_medica === "privado" ? "Seguro privado" : ficha.cobertura_medica === "ninguna" ? "Ninguna" : "—"}
            </td>
          </tr>
          <tr>
            <td className="campo">Grupo sanguíneo</td>
            <td>{ficha.grupo_sanguineo ?? "—"}</td>
          </tr>
          <tr>
            <td className="campo">Enfermedades/alergias/medicación</td>
            <td>{ficha.enfermedades_alergias ?? "Ninguna declarada"}</td>
          </tr>
          <tr>
            <td className="campo">Discapacidad/apoyo educativo</td>
            <td>{ficha.discapacidad_apoyo ?? "Ninguna declarada"}</td>
          </tr>
        </table>

        <h2>III. Datos de la madre, el padre y/o el responsable</h2>
        {responsables.map((r, i) => (
          <div key={i} className="bloque-responsable">
            <div className="etiqueta">{etiquetaVinculo(r.vinculo)}</div>
            <table>
              <tr>
                <td className="campo">Nombre y apellido</td>
                <td>{r.nombre}</td>
              </tr>
              <tr>
                <td className="campo">C.I. N°</td>
                <td>{r.cedula}</td>
              </tr>
              <tr>
                <td className="campo">Ocupación</td>
                <td>{r.ocupacion ?? "—"}</td>
              </tr>
              <tr>
                <td className="campo">Teléfono/WhatsApp</td>
                <td>{r.telefono}</td>
              </tr>
              <tr>
                <td className="campo">Correo electrónico</td>
                <td>{r.correo ?? "—"}</td>
              </tr>
              <tr>
                <td className="campo">Dirección</td>
                <td>{r.direccion}</td>
              </tr>
            </table>
          </div>
        ))}

        {ficha.emergencia_nombre && (
          <>
            <h2>IV. Contacto de emergencia</h2>
            <table>
              <tr>
                <td className="campo">Nombre y apellido</td>
                <td>{ficha.emergencia_nombre}</td>
              </tr>
              <tr>
                <td className="campo">Vínculo</td>
                <td>{ficha.emergencia_vinculo ?? "—"}</td>
              </tr>
              <tr>
                <td className="campo">Teléfono</td>
                <td>{ficha.emergencia_telefono ?? "—"}</td>
              </tr>
            </table>
          </>
        )}

        <div style={{ pageBreakBefore: "always" as React.CSSProperties["pageBreakBefore"] }} />

        <div style={{ textAlign: "center", margin: "10px 0 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>CARTA DE COMPROMISO</div>
        </div>

        <p>
          Mariano Roque Alonso, {new Date(ficha.completado_en!).toLocaleDateString("es-PY", { day: "2-digit", month: "long", year: "numeric" })}.
          Señor/a Director/a: {sujeto}, <strong>{nombres}</strong>, con C.I. N° <strong>{cedulas}</strong>, en calidad de{" "}
          <strong>{vinculos}</strong> del/de la estudiante <strong>{estudiante!.nombre_completo}</strong>, con C.I. N°{" "}
          <strong>{estudiante!.cedula ?? "—"}</strong>, matriculado/a en el{" "}
          <strong>{curso ? `${curso.grado}${curso.enfasis ? ` — ${curso.enfasis}` : ""}` : "—"}</strong>, turno{" "}
          <strong>{curso?.turno ?? "—"}</strong>, declaro/declaramos haber recibido y conocer las Normas de Convivencia del
          Colegio Nacional Mariano Roque Alonso y, junto con nuestro/a hijo/a o representado/a, nos comprometemos a:
        </p>

        {SECCIONES_CARTA.map((s) => (
          <div key={s.letra}>
            <h2>
              {s.letra}. {s.titulo}
            </h2>
            <ul>
              {s.puntos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
            <div className="aceptado">
              ✓ Leído, comprendido y aceptado el {formatearFecha(ficha[s.campo as keyof typeof ficha] as string | null)}
            </div>
          </div>
        ))}

        <div className="confirmacion-final">
          ✓ Confirmación final: &quot;Estoy de acuerdo con todo el compromiso asumido&quot; — {nombres}, firmado el{" "}
          {formatearFecha(ficha.confirmacion_final_en)}.
        </div>

        <h2>Documentos que debe entregar junto con este formulario</h2>
        <ul>
          <li>2 (dos) copias de la cédula de identidad del/de la estudiante</li>
          <li>2 (dos) copias de la cédula de identidad del padre, madre o responsable</li>
          <li>Esta Ficha Individual de Matriculación, completa</li>
          <li>La Carta de Compromiso firmada</li>
          <li>Autorización del Programa Hambre Cero, firmada</li>
        </ul>

        <div className="firma">
          <div className="linea">Firma del padre, madre, tutor/a o responsable</div>
          <div className="linea">Firma del/de la estudiante</div>
        </div>
      </div>
    </div>
  );
}
