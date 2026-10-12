// Reglas del sistema de evaluación del MEC Paraguay para el Tercer Ciclo EEB
// y la Educación Media (Bachillerato Científico).
//
// - Notas de 1 a 5, siempre números naturales (sin decimales).
// - La "ordinaria" es el promedio de etapa 1 y etapa 2.
// - Nota mínima para aprobar: 2 (debe alcanzarse de forma exacta: un promedio
//   de 1,5 NO redondea a 2 — se considera no aprobada).
// - Para promedios de 2,5 en adelante sí rige el redondeo matemático normal
//   (2,5 → 3, 3,5 → 4, 4,5 → 5).
// - Si la ordinaria no se aprueba, se evalúa un Complementario (nota única).
// - Si el Complementario tampoco se aprueba, en 7°, 8°, 1° y 2° Curso se
//   evalúa además una Regularización (nota única). 9° y 3° Curso no tienen
//   regularización: ahí la última instancia es el Complementario.

export const NOTA_MINIMA_APROBACION = 2;

/** Grados que tienen instancia de Regularización además del Complementario. */
const GRADOS_CON_REGULARIZACION = new Set(["7°", "8°", "1° Curso", "2° Curso"]);

export function tieneRegularizacion(grado: string | null | undefined): boolean {
  if (!grado) return false;
  return GRADOS_CON_REGULARIZACION.has(grado);
}

/** Calcula la nota de la ordinaria a partir de etapa 1 y etapa 2, aplicando la regla paraguaya de redondeo. */
export function calcularOrdinaria(etapa1: number, etapa2: number): number {
  const promedio = (etapa1 + etapa2) / 2;
  if (promedio === 1.5) return 1; // excepción: no redondea a la nota mínima (2)
  return Math.round(promedio); // 2,5→3, 3,5→4, 4,5→5 (redondeo matemático normal)
}

export function aprueba(nota: number | null | undefined): boolean {
  return typeof nota === "number" && nota >= NOTA_MINIMA_APROBACION;
}

export type Instancia = "etapa1" | "etapa2" | "ordinaria" | "complementario" | "regularizacion";

export const ETIQUETA_INSTANCIA: Record<Instancia, string> = {
  etapa1: "Etapa 1",
  etapa2: "Etapa 2",
  ordinaria: "Ordinaria",
  complementario: "Complementario",
  regularizacion: "Regularización",
};

export type NotasPorInstancia = Partial<Record<Instancia, number>>;

/**
 * Dado el set de notas cargadas para una disciplina, determina la nota final
 * vigente y si el estudiante aprobó esa materia.
 */
export function evaluarMateria(notas: NotasPorInstancia, grado: string | null | undefined) {
  if (aprueba(notas.ordinaria)) {
    return { notaFinal: notas.ordinaria!, instanciaFinal: "ordinaria" as Instancia, aprobado: true };
  }
  if (notas.complementario !== undefined) {
    if (aprueba(notas.complementario)) {
      return { notaFinal: notas.complementario, instanciaFinal: "complementario" as Instancia, aprobado: true };
    }
    if (!tieneRegularizacion(grado)) {
      return { notaFinal: notas.complementario, instanciaFinal: "complementario" as Instancia, aprobado: false };
    }
  }
  if (notas.regularizacion !== undefined) {
    return {
      notaFinal: notas.regularizacion,
      instanciaFinal: "regularizacion" as Instancia,
      aprobado: aprueba(notas.regularizacion),
    };
  }
  if (notas.ordinaria !== undefined) {
    return { notaFinal: notas.ordinaria, instanciaFinal: "ordinaria" as Instancia, aprobado: false };
  }
  return null;
}
