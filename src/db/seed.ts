import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import {
  account,
  departments,
  documentTypes,
  user,
} from "./schema";

// Cargamos .env.local antes de importar la conexión a la base de datos, porque
// ese módulo lee DATABASE_URL al inicializarse.
config({ path: ".env.local" });

const DEPARTMENTS = [
  "Recursos Humanos",
  "Tecnología",
  "Finanzas",
  "Operaciones",
  "Ventas",
] as const;

const DOCUMENT_TYPES = [
  { name: "Contrato de trabajo", isRequired: true },
  { name: "Cédula de identidad", isRequired: true },
  { name: "Título profesional", isRequired: true },
  { name: "Certificado de antecedentes penales", isRequired: false },
  { name: "Comprobante de domicilio", isRequired: false },
] as const;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Agrégala a .env.local antes de ejecutar el seed.`,
    );
  }

  return value;
}

async function seedDepartments(): Promise<void> {
  const { db } = await import("./index");

  await db
    .insert(departments)
    .values(DEPARTMENTS.map((name) => ({ name })))
    .onConflictDoNothing({ target: departments.name });

  console.log(`Departamentos listos (${DEPARTMENTS.length}).`);
}

async function seedDocumentTypes(): Promise<void> {
  const { db } = await import("./index");

  await db
    .insert(documentTypes)
    .values(
      DOCUMENT_TYPES.map((documentType) => ({
        name: documentType.name,
        isRequired: documentType.isRequired,
      })),
    )
    .onConflictDoNothing({ target: documentTypes.name });

  console.log(`Tipos de documento listos (${DOCUMENT_TYPES.length}).`);
}

async function seedAdminUser(): Promise<void> {
  const { db } = await import("./index");

  const adminEmail = getRequiredEnv("SEED_ADMIN_EMAIL").toLowerCase();
  const adminPassword = getRequiredEnv("SEED_ADMIN_PASSWORD");
  const adminName =
    process.env.SEED_ADMIN_NAME?.trim() || "Administrador de prueba";

  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, adminEmail))
    .limit(1);

  if (existingUser.length > 0) {
    console.log("El usuario administrador ya existe; no se creó de nuevo.");
    return;
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(adminPassword);

  await db.insert(user).values({
    id: userId,
    name: adminName,
    email: adminEmail,
    emailVerified: true,
    role: "admin",
  });

  // Better Auth guarda las contraseñas en la tabla account, no en user.
  // providerId "credential" corresponde al inicio de sesión con email y clave.
  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // No imprimimos la contraseña para no dejarla en registros de consola o CI.
  console.log(`Usuario administrador creado: ${adminEmail}`);
}

async function main(): Promise<void> {
  await seedDepartments();
  await seedDocumentTypes();
  await seedAdminUser();
  console.log("Seed completado correctamente.");
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Error desconocido en el seed.";
  console.error(`No se pudo completar el seed: ${message}`);
  process.exitCode = 1;
});
