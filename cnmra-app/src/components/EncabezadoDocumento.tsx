import Image from "next/image";

type DatoHeader = { label: string; value: string };

export default function EncabezadoDocumento({ titulo, datos }: { titulo: string; datos: DatoHeader[] }) {
  return (
    <div className="mb-4 border-b border-border pb-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Image src="/logo-cnmra.jpeg" alt="Escudo CNMRA" width={56} height={76} className="object-contain flex-none" />
        <Image src="/logo-gobierno.jpg" alt="Gobierno del Paraguay" width={160} height={34} className="object-contain flex-none" />
        <Image src="/logo-mec.jpg" alt="Ministerio de Educación y Ciencias" width={160} height={40} className="object-contain flex-none" />
      </div>

      <div className="text-center mt-3">
        <div className="font-display font-bold text-sm tracking-wide">COLEGIO NACIONAL MARIANO ROQUE ALONSO</div>
        <div className="font-display font-bold text-base mt-1">{titulo}</div>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
        {datos.map((d) => (
          <div key={d.label}>
            <span className="text-text-soft">{d.label}: </span>
            <span className="font-medium">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
