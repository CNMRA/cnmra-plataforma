"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import EncabezadoDocumento from "@/components/EncabezadoDocumento";
import { ANIO_LECTIVO_ACTIVO } from "@/lib/anio-lectivo";

type Curso = { id: string; grado: string; turno: string; ciclo: string; enfasis: string | null };
type Estudiante = { id: string; nombre_completo: string };
type Registro = {
  id: string;
  fecha: string;
  categoria: string;
  descripcion: string;
  disciplinas: { nombre: string } | null;
};

const etiquetaTurno: Record<string, string> = {
  mañana: "Turno mañana",
  tarde: "Turno tarde",
  noche: "Turno noche",
};

const etiquetaCategoria: Record<string, string> = {
  positivo: "Positivo",
  atencion: "A tener en cuenta",
  conducta: "Conducta",
};

export default function InformeAnecdoticoPage({ params }: { params: Promise<{ cursoId: string; estudianteId: string }> }) {
  const { cursoId, estudianteId } = use(params);
  const supabase = createClient();

  const [curso, setCurso] =
