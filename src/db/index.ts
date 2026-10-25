import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Conexión única a Neon mediante HTTP.
 *
 * Usamos el driver HTTP porque funciona bien en entornos serverless como
 * Vercel: cada consulta es una petición HTTPS y no requiere mantener un socket
 * abierto. La cadena de conexión siempre viene de una variable de entorno.
 */
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Falta la variable de entorno DATABASE_URL. Revisa tu archivo .env.local.",
  );
}

const sqlClient = neon(databaseUrl);

export const db = drizzle(sqlClient, { schema });

export type Database = typeof db;
