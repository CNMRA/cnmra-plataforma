"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  type Instancia,
  type NotasPorInstancia,
  ETIQUETA_INSTANCIA,
  evaluarMateria,
} from "@/lib/calificaciones";
import EncabezadoDocumento from "@/components/EncabezadoDocumento";
import { ANIO_LECTIVO_ACTIVO } from "@/lib/anio-lectivo";

type Curso = { id: string; grado: string; turno: string; ciclo: string; enfasis: string | null };
type Estudiante = { id: string; nombre_completo: string; cedula: string | null };
type Disciplina = { id: string; nombre: string; orden: number; plan: string };
type CalifRow = { disciplina_id: string; instancia: Instancia; nota: number | null };

const etiquetaTurno: Record<string, string> = {
  mañana: "Turno mañana",
  tarde: "Turno tarde",
  noche: "Turno noche",
};

const etiquetaPlan: Record<string, string> = {
  comun: "Plan Común",
  especifico: "Plan Específico",
  optativo: "Plan Optativo",
};

export default function LibretaCalificacionesPage({ params }: { params: Promise<{ cursoId: string; estudianteId: string }> }) {
  const { cursoId, estudianteId } = use(params);
  const supabase = createClient();

  const [curso, setCurso] = useState<Curso | null>(null);
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [califs, setCalifs] = useState<CalifRow[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const { data: cursoData } = await supabase
      .from("cursos")
      .select("id, grado, turno, ciclo, enfasis")
      .eq("id", cursoId)
