import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EstudiantesResumen from "@/components/EstudiantesResumen";

export default async function PanelInstitucional() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await supabase.from("perfiles").select("rol, acompanamiento").eq("id", user.id).single()
    : { data: null };

  const veDocentes =
    perfil?.rol === "director" || (perfil?.rol === "carga_datos" && perfil?.acompanamiento === true);

  // Carga de datos sin acompañamiento: ve directamente el resumen de estudiantes
  if (!veDocentes) {
    return <EstudiantesResumen conVolver={false} />;
  }

  const botones = [
    {
      href: "/institucion/estudiantes",
      icono: "🎒",
      titulo: "Estudiantes",
      texto: "Inscripción, cursos, avisos y alertas",
    },
    {
      href: "/institucion/docentes",
      icono: "👩‍🏫",
      titulo: "Docentes",
      texto: "Legajos, planes anuales, proyectos y planes diarios",
    },
  ];

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {botones.map((b) => (
          <Link
            key={b.href}
            href={b.href}
            className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center gap-3 hover:border-teal"
          >
            <span className="text-5xl">{b.icono}</span>
            <span className="font-display text-xl font-bold">{b.titulo}</span>
            <span className="text-xs text-text-soft">{b.texto}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
