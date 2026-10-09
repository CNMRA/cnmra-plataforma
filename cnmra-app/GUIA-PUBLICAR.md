# Cómo publicar la plataforma CNMRA (gratis)

Esta guía está pensada para alguien sin experiencia técnica. Son 4 partes.
Cuando llegues a cualquier paso que no te resulte claro, volvé a este chat y seguimos juntos.

---

## Parte 1 — Crear la base de datos (Supabase)

1. Entrá a **supabase.com** y creá una cuenta gratis (podés usar tu Google).
2. Creá un **New Project**. Ponele de nombre "cnmra", elegí una contraseña para la base
   de datos (guardala en un lugar seguro) y la región más cercana (São Paulo).
3. Una vez creado, andá al menú **SQL Editor** (ícono de la izquierda).
4. Abrí el archivo `supabase/migrations/0001_init.sql` de este proyecto, copiá **todo**
   su contenido, pegalo en el SQL Editor de Supabase, y apretá **Run**.
   - Esto crea todas las tablas (estudiantes, familias, cursos, calificaciones, etc.)
     y ya carga los cursos reales del PEI.

---

## Parte 2 — Crear tu usuario como Director

1. En Supabase, andá a **Authentication → Users → Add user**.
2. Cargá tu correo y una contraseña (la que vas a usar para entrar a la plataforma).
3. Copiá el **User UID** que aparece (un código largo tipo `a1b2c3d4-...`).
4. Volvé a **SQL Editor**, pegá esto (cambiando el UID y tu nombre) y apretá Run:

```sql
insert into perfiles (id, nombre_completo, rol)
values ('PEGÁ-ACÁ-EL-UID', 'Tu Nombre Completo', 'director');
```

Con esto ya podés entrar a la plataforma como Director, con acceso total.

Más adelante, para cada una de las 8 personas del equipo de carga de datos hacés
lo mismo (Add user + copiar UID), pero en vez de hacerlo por SQL Editor, una vez
que vos ya estés adentro como Director, podés cargarlas directamente desde la
pantalla **Usuarios** de la plataforma (pegando el UID y el nombre).

---

## Parte 3 — Conectar el código con tu base de datos

1. En Supabase, andá a **Project Settings → API**.
2. Copiá los dos valores: **Project URL** y **anon public key**.
3. En este proyecto, renombrá el archivo `.env.local.example` a `.env.local`
   y pegá ahí esos dos valores.

---

## Parte 4 — Publicarla en internet (gratis, sin dominio)

1. Entrá a **vercel.com** y creá una cuenta gratis.
2. Subí este proyecto a una cuenta de GitHub (si no tenés, te ayudo a crear una)
   y en Vercel elegí **Import Project** desde ese repositorio.
3. Cuando te pida las variables de entorno, pegá las mismas dos de la Parte 3
   (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Apretá **Deploy**. En un minuto vas a tener un link tipo `cnmra.vercel.app`
   que ya funciona — ese es el que podés compartir para probar la plataforma,
   e instalarla como app desde el celular (abrir el link → "Agregar a pantalla
   de inicio").

Cuando decidas comprar el dominio `.edu.py`, ese paso se hace aparte y no
requiere tocar el código: solo se conecta el dominio nuevo a este mismo
proyecto en Vercel.

---

Si te trabás en cualquier paso, volvé a este chat, contame en qué parte estás
y seguimos desde ahí.
