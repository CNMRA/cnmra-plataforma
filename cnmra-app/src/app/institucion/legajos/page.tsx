import { redirect } from "next/navigation";

// La lista de legajos ahora está dentro de Docentes.
export default function LegajosRedirect() {
  redirect("/institucion/docentes?tab=legajos");
}
