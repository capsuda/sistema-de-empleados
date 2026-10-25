import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Carga las variables de .env.local para que drizzle-kit las pueda leer
dotenv.config({ path: ".env.local" });

// Las migraciones usan la conexión directa (sin pooling). Neon la expone como
// DATABASE_URL_UNPOOLED; si no existe, usamos DATABASE_URL como respaldo.
const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Falta DATABASE_URL_UNPOOLED o DATABASE_URL en .env.local.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
