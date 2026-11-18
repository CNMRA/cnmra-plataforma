"use client";

import { useState } from "react";
import BotonImprimir from "@/components/BotonImprimir";
import { LOGO_GOBIERNO, LOGO_HAMBRE_CERO } from "@/lib/hambre-cero-logos";

type Datos = {
  respNombre: string;
  respCedula: string;
  respVinculo: string;
  estNombre: string;
  estCedula: string;
  institucion: string;
  gradoCurso: string;
  turno: string;
  volverHref: string;
};

const SERVICIOS = [
  { id: "desayuno", texto: "Desayuno escolar (Turno mañana)" },
  { id: "almuerzo", texto: "Almuerzo escolar (Ambos turnos)" },
  { id: "merienda", texto: "Merienda escolar (Turno tarde)" },
  { id: "cena", texto: "Cena escolar/colación (Turno noche, EEB Tercer Ciclo - EM)" },
];

const ALERGIAS = ["Huevo", "Sésamo", "Trigo", "Leche de vaca", "Pescado"];
const INTOLERANCIAS = ["Lactosa", "Gluten", "Fructosa", "Sacarosa", "Otros"];
const PATOLOGIAS = ["Diabetes", "Hipertensión", "Fibrosis Quística", "Epilepsia"];
const FILAS = 5;

function Dato({ valor, ancho }: { valor: string; ancho: string }) {
  return (
    <span className="dato" style={{ minWidth: ancho }}>
      {valor.trim() ? valor : " "}
    </span>
  );
}

export default function HambreCeroFormulario({ d }: { d: Datos }) {
  const [autoriza, setAutoriza] = useState<"" | "si" | "no">("");
  const [servicios, setServicios] = useState<Record<string, boolean>>({});
  const [padece, setPadece] = useState<"" | "si" | "no">("");
  const [salud, setSalud] = useState<Record<string, boolean>>({});
  const [otrosTexto, setOtrosTexto] = useState("");
  const [vista, setVista] = useState<"preguntas" | "documento">("preguntas");
  const [aviso, setAviso] = useState<string | null>(null);

  const turnoNorm = d.turno.trim().toLowerCase();
  const serviciosVisibles = SERVICIOS.filter((s) => {
    if (turnoNorm === "mañana") return s.id === "desayuno" || s.id === "almuerzo";
    if (turnoNorm === "tarde") return s.id === "merienda" || s.id === "almuerzo";
    if (turnoNorm === "noche") return s.id === "cena" || s.id === "almuerzo";
    return true;
  });

  function elegirAutoriza(v: "si" | "no") {
    setAutoriza(v);
    setAviso(null);
    if (v === "no") setServicios({});
  }

  function elegirPadece(v: "si" | "no") {
    setPadece(v);
    setAviso(null);
    if (v === "no") {
      setSalud({});
      setOtrosTexto("");
    }
  }

  function alternarServicio(id: string) {
    setAviso(null);
    setServicios((p) => ({ ...p, [id]: !p[id] }));
  }

  function alternarSalud(clave: string) {
    setAviso(null);
    setSalud((p) => ({ ...p, [clave]: !p[clave] }));
  }

  function verFormulario() {
    if (!autoriza) {
      setAviso("Respondé si autorizás o no a tu hijo/a.");
      return;
    }
    if (autoriza === "si" && !serviciosVisibles.some((s) => servicios[s.id])) {
      setAviso("Marcá al menos un servicio que autorizás.");
      return;
    }
    if (!padece) {
      setAviso("Respondé si tu hijo/a padece alguna patología, intolerancia o alergia.");
      return;
    }
    if (padece === "si" && !Object.values(salud).some(Boolean)) {
      setAviso("Marcá cuál es la alergia, intolerancia o patología de tu hijo/a.");
      return;
    }
    setAviso(null);
    setVista("documento");
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  const opcionSalud = (grupo: string, nombre: string) => {
    const clave = `${grupo}:${nombre}`;
    return (
      <div key={clave}>
        <label className="flex items-center gap-3 text-sm py-1.5">
          <input type="checkbox" className="w-5 h-5" checked={Boolean(salud[clave])} onChange={() => alternarSalud(clave)} />
          {nombre}
        </label>
        {clave === "Intolerancias:Otros" && salud[clave] && (
          <input
            value={otrosTexto}
            onChange={(e) => setOtrosTexto(e.target.value)}
            placeholder="¿Cuál? (opcional)"
            className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card mb-1"
          />
        )}
      </div>
    );
  };

  const botonSiNo = (activo: boolean, texto: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 flex-1 rounded-xl border text-sm font-semibold ${activo ? "bg-navy text-white border-navy" : "bg-card border-border"}`}
    >
      {texto}
    </button>
  );

  // Celda del documento impreso: nombre + X si está marcada
  const celdaDoc = (grupo: string, nombre: string | undefined) => {
    if (!nombre) return <td>&nbsp;</td>;
    const clave = `${grupo}:${nombre}`;
    const extra = clave === "Intolerancias:Otros" && salud[clave] && otrosTexto.trim() ? ` ${otrosTexto.trim()}` : "";
    return (
      <td>
        {nombre}: <b>{salud[clave] ? "X" : " "}</b>
        {extra}
      </td>
    );
  };

  if (vista === "preguntas") {
    return (
      <div className="flex flex-col gap-5 max-w-xl">
        <div>
          <a href={d.volverHref} className="text-xs text-teal font-medium">
            ← Volver
          </a>
          <h1 className="font-display text-2xl mt-1">Programa Hambre Cero</h1>
          <p className="text-sm text-text-soft mt-1">
            Autorización de alimentación escolar de <strong>{d.estNombre}</strong>. Respondé estas preguntas: el sistema completa
            el formulario y vos solo lo imprimís y lo firmás.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <h2 className="font-semibold text-sm">1. ¿Autorizás a tu hijo/a a recibir el servicio de alimentación escolar?</h2>
          <div className="flex gap-3">
            {botonSiNo(autoriza === "si", "Sí, autorizo", () => elegirAutoriza("si"))}
            {botonSiNo(autoriza === "no", "No autorizo", () => elegirAutoriza("no"))}
          </div>

          {autoriza === "si" && (
            <div className="border-t border-border pt-4 flex flex-col gap-1">
              <h3 className="font-semibold text-sm mb-1">¿Qué servicio autorizás?</h3>
              {serviciosVisibles.map((s) => (
                <label key={s.id} className="flex items-center gap-3 text-sm py-1.5">
                  <input type="checkbox" className="w-5 h-5" checked={Boolean(servicios[s.id])} onChange={() => alternarServicio(s.id)} />
                  {s.texto}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <h2 className="font-semibold text-sm">
            2. ¿Tu hijo/a padece de alguna patología, intolerancia o alergia que requiera una alimentación con cuidados?
          </h2>
          <div className="flex gap-3">
            {botonSiNo(padece === "si", "Sí", () => elegirPadece("si"))}
            {botonSiNo(padece === "no", "No", () => elegirPadece("no"))}
          </div>

          {padece === "si" && (
            <div className="border-t border-border pt-4 flex flex-col gap-4">
              <p className="text-xs text-text-soft">Marcá todas las que correspondan.</p>
              <div>
                <h3 className="font-semibold text-sm mb-1">Alergias</h3>
                {ALERGIAS.map((n) => opcionSalud("Alergias", n))}
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Intolerancias</h3>
                {INTOLERANCIAS.map((n) => opcionSalud("Intolerancias", n))}
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Patologías</h3>
                {PATOLOGIAS.map((n) => opcionSalud("Patologías", n))}
              </div>
            </div>
          )}
        </div>

        {aviso && <div className="text-sm text-text-soft bg-bg rounded-lg px-3 py-2">{aviso}</div>}

        <button type="button" onClick={verFormulario} className="h-12 rounded-xl bg-navy text-white font-semibold text-sm px-6 w-fit">
          Ver formulario para imprimir
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white text-black">
      <style>{`
        @media print {
          .no-imprimir { display: none !important; }
          body { background: #fff; }
          @page { size: 216mm 330mm; margin: 8mm 12mm; }
        }
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

      <div className="no-imprimir sticky top-0 bg-[#F7F7F5] border-b border-[#E5E3DD] px-5 py-3 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setVista("preguntas")} className="text-sm text-teal font-medium">
          ← Cambiar respuestas
        </button>
        <BotonImprimir />
      </div>

      <div className="no-imprimir px-5 pt-3 text-xs text-text-soft">
        Revisá que esté todo bien. Imprimí el formulario y firmalo en la línea de abajo.
      </div>

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
            <div className="cuadro">{autoriza === "si" ? "X" : ""}</div>
            <div>
              Sí autorizo suficientemente para que mi hijo/a reciba el servicio de alimentación escolar seleccionada en la Tabla
              1, durante la permanencia del mismo en la institución educativa durante los 5 días de la semana, y por todos los
              días del calendario escolar.
            </div>
          </div>

          <div className="opcion">
            <div className="cuadro">{autoriza === "no" ? "X" : ""}</div>
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
              {SERVICIOS.map((s) => (
                <tr key={s.id}>
                  <td className="serv">{s.texto}</td>
                  <td className="marca">{servicios[s.id] ? "X" : " "}</td>
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
                <td className="marcable">{padece === "si" ? "X" : " "}</td>
                <td>NO</td>
                <td className="marcable">{padece === "no" ? "X" : " "}</td>
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
                  {celdaDoc("Alergias", ALERGIAS[i])}
                  {celdaDoc("Intolerancias", INTOLERANCIAS[i])}
                  {celdaDoc("Patologías", PATOLOGIAS[i])}
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
