"use client";

import {
  ALERGIAS_HC,
  INTOLERANCIAS_HC,
  PATOLOGIAS_HC,
  serviciosVisiblesHC,
  type RespuestasHC,
} from "@/components/HambreCeroDocumento";

export default function HambreCeroPreguntas({
  turno,
  valor,
  onChange,
}: {
  turno: string;
  valor: RespuestasHC;
  onChange: (v: RespuestasHC) => void;
}) {
  const servicios = serviciosVisiblesHC(turno);

  const botonSiNo = (activo: boolean, texto: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 flex-1 rounded-xl border text-sm font-semibold ${activo ? "bg-navy text-white border-navy" : "bg-card border-border"}`}
    >
      {texto}
    </button>
  );

  const opcionSalud = (grupo: string, nombre: string) => {
    const clave = `${grupo}:${nombre}`;
    return (
      <div key={clave}>
        <label className="flex items-center gap-3 text-sm py-1.5">
          <input
            type="checkbox"
            className="w-5 h-5"
            checked={Boolean(valor.salud[clave])}
            onChange={() => onChange({ ...valor, salud: { ...valor.salud, [clave]: !valor.salud[clave] } })}
          />
          {nombre}
        </label>
        {clave === "Intolerancias:Otros" && valor.salud[clave] && (
          <input
            value={valor.otros}
            onChange={(e) => onChange({ ...valor, otros: e.target.value })}
            placeholder="¿Cuál? (opcional)"
            className="h-10 w-full rounded-lg border border-border px-3 text-sm bg-card mb-1"
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <h2 className="font-semibold text-sm">1. ¿Autorizás a tu hijo/a a recibir el servicio de alimentación escolar?</h2>
        <div className="flex gap-3">
          {botonSiNo(valor.autoriza === "si", "Sí, autorizo", () => onChange({ ...valor, autoriza: "si" }))}
          {botonSiNo(valor.autoriza === "no", "No autorizo", () => onChange({ ...valor, autoriza: "no", servicios: {} }))}
        </div>

        {valor.autoriza === "si" && (
          <div className="border-t border-border pt-4 flex flex-col gap-1">
            <h3 className="font-semibold text-sm mb-1">¿Qué servicio autorizás?</h3>
            {servicios.map((s) => (
              <label key={s.id} className="flex items-center gap-3 text-sm py-1.5">
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={Boolean(valor.servicios[s.id])}
                  onChange={() => onChange({ ...valor, servicios: { ...valor.servicios, [s.id]: !valor.servicios[s.id] } })}
                />
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
          {botonSiNo(valor.padece === "si", "Sí", () => onChange({ ...valor, padece: "si" }))}
          {botonSiNo(valor.padece === "no", "No", () => onChange({ ...valor, padece: "no", salud: {}, otros: "" }))}
        </div>

        {valor.padece === "si" && (
          <div className="border-t border-border pt-4 flex flex-col gap-4">
            <p className="text-xs text-text-soft">Marcá todas las que correspondan.</p>
            <div>
              <h3 className="font-semibold text-sm mb-1">Alergias</h3>
              {ALERGIAS_HC.map((n) => opcionSalud("Alergias", n))}
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1">Intolerancias</h3>
              {INTOLERANCIAS_HC.map((n) => opcionSalud("Intolerancias", n))}
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1">Patologías</h3>
              {PATOLOGIAS_HC.map((n) => opcionSalud("Patologías", n))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
