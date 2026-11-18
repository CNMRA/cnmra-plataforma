import { LOGO_GOBIERNO, LOGO_HAMBRE_CERO } from "@/lib/hambre-cero-logos";

export type RespuestasHC = {
  autoriza: "" | "si" | "no";
  servicios: Record<string, boolean>;
  padece: "" | "si" | "no";
  salud: Record<string, boolean>;
  otros: string;
};

export const RESPUESTAS_HC_VACIAS: RespuestasHC = { autoriza: "", servicios: {}, padece: "", salud: {}, otros: "" };

export type DatosHC = {
  respNombre: string;
  respCedula: string;
  respVinculo: string;
  estNombre: string;
  estCedula: string;
  institucion: string;
  gradoCurso: string;
  turno: string;
};

export const SERVICIOS_HC = [
  { id: "desayuno", texto: "Desayuno escolar (Turno mañana)" },
  { id: "almuerzo", texto: "Almuerzo escolar (Ambos turnos)" },
  { id: "merienda", texto: "Merienda escolar (Turno tarde)" },
  { id: "cena", texto: "Cena escolar/colación (Turno noche, EEB Tercer Ciclo - EM)" },
];

export const ALERGIAS_HC = ["Huevo", "Sésamo", "Trigo", "Leche de vaca", "Pescado"];
export const INTOLERANCIAS_HC = ["Lactosa", "Gluten", "Fructosa", "Sacarosa", "Otros"];
export const PATOLOGIAS_HC = ["Diabetes", "Hipertensión", "Fibrosis Quística", "Epilepsia"];

export function serviciosVisiblesHC(turno: string) {
  const t = turno.trim().toLowerCase();
  return SERVICIOS_HC.filter((s) => {
    if (t === "mañana") return s.id === "desayuno" || s.id === "almuerzo";
    if (t === "tarde") return s.id === "merienda" || s.id === "almuerzo";
    if (t === "noche") return s.id === "cena" || s.id === "almuerzo";
    return true;
  });
}

// Devuelve un mensaje si falta algo, o null si está todo bien.
export function validarHC(r: RespuestasHC, turno: string): string | null {
  if (!r.autoriza) return "Respondé si autorizás o no a tu hijo/a.";
  if (r.autoriza === "si" && !serviciosVisiblesHC(turno).some((s) => r.servicios[s.id])) {
    return "Marcá al menos un servicio que autorizás.";
  }
  if (!r.padece) return "Respondé si tu hijo/a padece alguna patología, intolerancia o alergia.";
  if (r.padece === "si" && !Object.values(r.salud).some(Boolean)) {
    return "Marcá cuál es la alergia, intolerancia o patología de tu hijo/a.";
  }
  return null;
}

const FILAS = 5;

function Dato({ valor, ancho }: { valor: string; ancho: string }) {
  return (
    <span className="dato" style={{ minWidth: ancho }}>
      {valor.trim() ? valor : " "}
    </span>
  );
}

export default function HambreCeroDocumento({ d, r }: { d: DatosHC; r: RespuestasHC }) {
  const celda = (grupo: string, nombre: string | undefined) => {
    if (!nombre) return <td>&nbsp;</td>;
    const clave = `${grupo}:${nombre}`;
    const extra = clave === "Intolerancias:Otros" && r.salud[clave] && r.otros.trim() ? ` ${r.otros.trim()}` : "";
    return (
      <td>
        {nombre}: <b>{r.salud[clave] ? "X" : " "}</b>
        {extra}
      </td>
    );
  };

  return (
    <div className="hc-pagina">
      <style>{`
        @page hc { size: 216mm 330mm; margin: 8mm 12mm; }
        @media print { .hc-pagina { break-before: page; page: hc; } }
        .hc-pagina { background: #fff; color: #000; border-top: 3px dashed #bbb; margin-top: 30px; }
        @media print { .hc-pagina { border-top: none; margin-top: 0; } }
        .hc { font-family: "Book Antiqua", "Palatino Linotype", Palatino, "URW Palladio L", Georgia, serif; font-size: 10pt; line-height: 1.36; max-width: 760px; margin: 0 auto; padding: 14px 16px 30px; color: #000; }
        .hc .logos { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .hc .logos img { display: block; }
        .hc .titulo { text-align: center; font-weight: 700; font-size: 10pt; text-transform: uppercase; margin: 4px 0 10px; }
        .hc .subtitulo { text-align: center; font-weight: 700; font-size: 11pt; margin: 0 0 8px; }
        .hc .caja { border: 1px solid #000; padding: 8px 8px 10px; text-align: justify; }
        .hc p { margin: 0 0 8px; }
        .hc .dato { display: inline-block; border-bottom: 1px dotted #000; padding: 0 3px; font-weight: 700; text-align: center; vertical-align: baseline; }
        .hc .pista { font-style: italic; font-size: 8.5pt; }
        .hc .opcion { display: flex; gap: 10px; align-items: flex-start; margin: 0 0 8px 8px; }
        .hc .cuadro { flex: none; width: 36px; height: 26px; border: 1px solid #000; display: flex; align-items: center; justify-content: center; font-weight: 700; background: #fff; }
        .hc table { border-collapse: collapse; }
        .hc .tabla1 { margin: 6px auto 8px; width: 78%; }
        .hc .tabla1 th, .hc .tabla1 td { border: 1px solid #000; padding: 0 6px; font-size: 9.5pt; line-height: 1.3; }
        .hc .tabla1 th { background: #d9d9d9; font-weight: 700; }
        .hc .tabla1 td.serv { text-align: center; }
        .hc .tabla1 td.marca { width: 22%; text-align: center; font-weight: 700; }
        .hc .ref { font-size: 8pt; margin-bottom: 8px; }
        .hc .sino { margin: 2px auto 10px; }
        .hc .sino td { border: 1px solid #000; padding: 0 8px; font-size: 9.5pt; min-width: 34px; height: 18px; text-align: center; }
        .hc .sino td.marcable { font-weight: 700; }
        .hc .salud { margin: 2px auto 8px; width: 84%; }
        .hc .salud th, .hc .salud td { border: 1px solid #000; padding: 0 5px; font-size: 9.5pt; text-align: left; line-height: 1.3; white-space: nowrap; }
        .hc .salud th { background: #d9d9d9; font-weight: 700; }
        .hc .firma { text-align: center; margin-top: 34px; }
        .hc .firma .puntos { letter-spacing: 1px; }
        .hc .pie { margin-top: 10px; }
      `}</style>

      <div className="hc">
        <div className="logos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_GOBIERNO} alt="Gobierno del Paraguay - Consejo Nacional de Alimentación Escolar" style={{ width: 250, height: "auto" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_HAMBRE_CERO} alt="Hambre Cero en las Escuelas" style={{ width: 140, height: "auto" }} />
        </div>

        <div className="titulo">
          Programa de Alimentación Escolar Hambre Cero en nuestras Escuelas –<br />
          PAE-H0
        </div>
        <div className="subtitulo">FICHA DE AUTORIZACIÓN LEGAL</div>

        <div className="caja">
          <p>
            <strong>Padres de familia o encargados:</strong>
          </p>

          <p>
            La institución educativa cuenta con el servicio de alimentación escolar, en el marco del Programa de Alimentación
            Escolar Hambre Cero en nuestras Escuelas, conforme lo establece la{" "}
            <strong>
              <em>Ley N° 7264/24</em>
            </strong>{" "}
            <em>“Que crea el Fondo Nacional de Alimentación Escolar para la Universalización Equitativa de la Alimentación Escolar…”</em>.
          </p>

          <p>
            En ese sentido, atendiendo lo establecido en el Artículo 9° de la mencionada Ley{" "}
            <em>
              “inciso d) Autorización legal: para el acceso a la alimentación escolar por parte de la población estudiantil, se
              requiere indefectiblemente de la autorización legal del padre, madre o encargado, en su condición de titular de la
              patria potestad”
            </em>
            .
          </p>

          <p>
            Por lo tanto, yo <Dato valor={d.respNombre} ancho="250px" /> <span className="pista">(escribir el nombre de la madre, padre o encargado)</span>,
            con cédula de identidad civil N°: <Dato valor={d.respCedula} ancho="110px" />, <Dato valor={d.respVinculo} ancho="90px" />{" "}
            <span className="pista">(completar si es madre, padre o encargado)</span>, del estudiante{" "}
            <Dato valor={d.estNombre} ancho="250px" /> <span className="pista">(escribir el nombre del hijo/a)</span>, con cédula de identidad civil N°:{" "}
            <Dato valor={d.estCedula} ancho="110px" />, estudiante de la institución educativa <Dato valor={d.institucion} ancho="260px" />{" "}
            <span className="pista">(escribir el nombre de la institución educativa)</span>, del grado/curso <Dato valor={d.gradoCurso} ancho="170px" />, del
            turno <Dato valor={d.turno} ancho="80px" />, <span className="pista">(escribir turno mañana o tarde)</span>.
          </p>

          <div className="opcion">
            <div className="cuadro">{r.autoriza === "si" ? "X" : ""}</div>
            <div>
              Sí autorizo suficientemente para que mi hijo/a reciba el servicio de alimentación escolar seleccionada en la Tabla
              1, durante la permanencia del mismo en la institución educativa durante los 5 días de la semana, y por todos los
              días del calendario escolar.
            </div>
          </div>

          <div className="opcion">
            <div className="cuadro">{r.autoriza === "no" ? "X" : ""}</div>
            <div>No autorizo a que mi hijo/a reciba el servicio de alimentación escolar.</div>
          </div>

          <p>En caso de no autorizar, pasar directamente a la firma del documento.</p>

          <table className="tabla1">
            <thead>
              <tr>
                <th colSpan={2}>Tabla 1. Marcar con una X el servicio de alimentación escolar que se autoriza:</th>
              </tr>
            </thead>
            <tbody>
              {SERVICIOS_HC.map((s) => (
                <tr key={s.id}>
                  <td className="serv">{s.texto}</td>
                  <td className="marca">{r.servicios[s.id] ? "X" : " "}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="ref">
            <strong>Referencia:</strong> Desayuno es proveído para los estudiantes que asisten en el Turno mañana. Merienda es
            proveído a los estudiantes que asisten en el Turno Tarde. Almuerzo es para ambos turnos. La cena escolar/colación es
            proveído en el turno noche.
          </p>

          <p style={{ marginBottom: 2 }}>
            ¿Su hijo/a padece de alguna patología/ intolerancia/ alergia que requiera una alimentación con cuidados? Marque con
            una X lo que corresponde.
          </p>
          <table className="sino">
            <tbody>
              <tr>
                <td>SI</td>
                <td className="marcable">{r.padece === "si" ? "X" : " "}</td>
                <td>NO</td>
                <td className="marcable">{r.padece === "no" ? "X" : " "}</td>
              </tr>
            </tbody>
          </table>

          <p style={{ marginBottom: 2 }}>
            En caso de que la respuesta sea afirmativa, por favor marque con una X lo que corresponde (puede marcar más de una
            opción):
          </p>
          <table className="salud">
            <thead>
              <tr>
                <th>Alergias</th>
                <th>Intolerancias</th>
                <th>Patologías</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: FILAS }).map((_, i) => (
                <tr key={i}>
                  {celda("Alergias", ALERGIAS_HC[i])}
                  {celda("Intolerancias", INTOLERANCIAS_HC[i])}
                  {celda("Patologías", PATOLOGIAS_HC[i])}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="firma">
            <div className="puntos">…………………………………………………………</div>
            <div>Firma de la madre, padre o responsable autorizante</div>
          </div>

          <div className="pie">
            <p style={{ marginBottom: 2 }}>Adjuntar fotocopia de Cédula de Identidad del estudiante y de la madre, padre, o encargado.</p>
            <p style={{ marginBottom: 0 }}>Completar una ficha de Autorización por estudiante, por cada año.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
