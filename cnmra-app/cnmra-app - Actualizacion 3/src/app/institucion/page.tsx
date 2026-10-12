import { createClient } from "@/lib/supabase/server";

export default async function PanelInstitucional() {
  const supabase = await createClient();

  const [{ count: estudiantesActivos }, { count: inscripcionesPendientes }, { data: alertas }] =
    await Promise.all([
      supabase.from("estudiantes").select("*", { count: "exact", head: true }).eq("estado", "activo"),
      supabase.from("inscripciones").select("*", { count: "exact", head: true }).eq("estado", "pendiente"),
      supabase
        .from("alertas")
        .select("id, mensaje, severidad, creado_en, estudiantes(nombre_completo)")
        .order("creado_en", { ascending: false })
        .limit(6),
    ]);

  const hoy = new Date().toISOString().slice(0, 10);
  const { count: presentesHoy } = await supabase
    .from("asistencias")
    .select("*", { count: "exact", head: true })
    .eq("fecha", hoy)
    .eq("estado", "presente");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Panel institucional</h1>
        <p className="text-sm text-text-soft mt-1">
          {new Date().toLocaleDateString("es-PY", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          · Ciclo lectivo {new Date().getFullYear()}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Estudiantes activos" value={estudiantesActivos ?? 0} />
        <Stat label="Inscripciones pendientes" value={inscripcionesPendientes ?? 0} color="text-warning" />
        <Stat label="Presentes hoy" value={presentesHoy ?? 0} color="text-success" />
        <Stat label="Alertas recientes" value={alertas?.length ?? 0} color="text-danger" />
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-display text-lg mb-3">Últimas alertas</h3>
        {!alertas || alertas.length === 0 ? (
          <p className="text-sm text-text-soft">Todavía no hay alertas cargadas.</p>
        ) : (
          <div className="flex flex-col">
            {alertas.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-none">
                <span
                  className={`w-2 h-2 rounded-full flex-none ${
                    a.severidad === "alta" ? "bg-danger" : a.severidad === "media" ? "bg-warning" : "bg-gold"
                  }`}
                />
                <div className="flex-1">
                  <div className="text-[13.5px] font-medium">
                    {(a.estudiantes as unknown as { nombre_completo: string } | null)?.nombre_completo ?? "—"}
                  </div>
                  <div className="text-xs text-text-soft">{a.mensaje}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs text-text-soft">{label}</div>
      <div className={`font-display text-[28px] font-bold mt-1.5 ${color ?? ""}`}>{value}</div>
    </div>
  );
}
