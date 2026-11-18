import { redirect } from "next/navigation";

// La autorización del Programa Hambre Cero ahora forma parte del proceso de matriculación.
export default async function HambreCero({ params }: { params: Promise<{ estudianteId: string }> }) {
  const { estudianteId } = await params;
  redirect(`/familia/matriculacion-2027/${estudianteId}`);
}
