import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DocenteNav from "@/components/DocenteNav";

export default async function DocenteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, rol")
    .eq("id", user.id)
    .single();

  if (!perfil || perfil.rol !== "docente") redirect("/login");

  return (
    <div className="min-h-screen bg-bg">
      <DocenteNav nombre={perfil.nombre_completo} />
      <div className="max-w-4xl mx-auto p-5 md:p-8 flex flex-col gap-5">{children}</div>
    </div>
  );
}
