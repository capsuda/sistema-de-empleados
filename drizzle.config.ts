import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Carga las variables de .env.local para que drizzle-kit las pueda leer
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
