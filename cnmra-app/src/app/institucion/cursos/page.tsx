import { createClient } from "@/lib/supabase/server";

type Curso = {
  id: string;
  turno: string;
  ciclo: string;
  enfasis: string | null;
  grado: string;
  orden: number;
  secciones: { id: string; nombre: string }[];
};

export default async function CursosPage() {
  const supabase = await createClient();
  const { data: cursos } = await supabase
    .from("cursos")
    .select("id, turno, ciclo, enfasis, grado, orden, secciones(id, nombre)")
    .order("orden");

  const porTurno: Record<string, Curso[]> = {};
  (cursos as Curso[] | null)?.forEach((c) => {
    porTurno[c.turno] = porTurno[c.turno] ?? [];
    porTurno[c.turno].push(c);
  });

  const etiquetaTurno: Record<string, string> = {
    mañana: "Turno mañana",
    tarde: "Turno tarde",
    noche: "Turno noche",
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Cursos y secciones</h1>
        <p className="text-sm text-text-soft mt-1 max-w-xl">
          Oferta académica cargada en la base de datos — alimenta los selectores de
          Inscripción, Seguimiento, Calificaciones y Alertas.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {Object.entries(porTurno).map(([turno, lista]) => {
          const porCiclo: Record<string, Curso[]> = {};
          lista.forEach((c) => {
            const clave = c.enfasis ? `${c.ciclo} — Énfasis en ${c.enfasis}` : c.ciclo;
            porCiclo[clave] = porCiclo[clave] ?? [];
            porCiclo[clave].push(c);
          });

          return (
            <div key={turno} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
              <div className="text-[11px] font-bold tracking-wide text-navy bg-[#E7EAFB] inline-flex w-fit px-2.5 py-1 rounded-full uppercase">
                {etiquetaTurno[turno] ?? turno}
              </div>
              {Object.entries(porCiclo).map(([ciclo, cursosCiclo]) => (
                <div key={ciclo}>
                  <div className="text-[12.5px] font-semibold mb-2">{ciclo}</div>
                  <div className="flex flex-col gap-1.5">
                    {cursosCiclo.map((c) => (
                      <div key={c.id} className="flex items-center justify-between bg-bg rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium">{c.grado}</span>
                        <span className="text-text-soft text-xs">
                          {c.secciones.length > 0
                            ? `Secciones ${c.secciones.map((s) => s.nombre).sort().join(" · ")}`
                            : "Sin secciones"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {(!cursos || cursos.length === 0) && (
        <div className="bg-card border border-border rounded-xl p-5 text-sm text-text-soft">
          Todavía no hay cursos cargados en la base de datos. Ejecutá la migración
          inicial (<code>supabase/migrations/0001_init.sql</code>) para cargar la
          estructura del PEI.
        </div>
      )}
    </div>
  );
}
