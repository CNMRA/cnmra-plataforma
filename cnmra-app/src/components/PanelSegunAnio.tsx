"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAnioLectivo } from "@/lib/anio-lectivo";

export default function PanelSegunAnio({ veDocentes, resumen }: { veDocentes: boolean; resumen: ReactNode }) {
  const { anio } = useAnioLectivo();

  // Fuera de 2027, o sin permiso para Docentes: se ve directamente el resumen de estudiantes
  if (!(veDocentes && anio === 2027)) return <>{resumen}</>;

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
        <p className="text-sm text-text-soft mt-1" suppressHydrationWarning>
          {new Date().toLocaleDateString("es-PY", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          · Ciclo lectivo {anio}
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
