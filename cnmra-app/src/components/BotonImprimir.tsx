"use client";

export default function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-10 px-5 rounded-lg bg-navy text-white font-semibold text-sm"
    >
      Imprimir / Descargar PDF
    </button>
  );
}
