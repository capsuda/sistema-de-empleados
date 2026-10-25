import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Roles del sistema.
 *
 * Se modelan como un enum de PostgreSQL para que la base de datos rechace
 * cualquier valor inventado, incluso si un error en el servidor intentara
 * insertarlo. La autorización real se valida igualmente en el servidor.
 */
export const userRoleEnum = pgEnum("user_role", ["admin", "rrhh", "empleado"]);

/**
 * Estados posibles de un empleado.
 */
export const employeeStatusEnum = pgEnum("employee_status", [
  "activo",
  "inactivo",
]);

// ---------------------------------------------------------------------------
// Tablas de autenticación (Better Auth)
// ---------------------------------------------------------------------------
// Los nombres de las propiedades se mantienen en camelCase porque el adaptador
// de Drizzle de Better Auth las usa para mapear sus campos internos. Los
// nombres de las columnas en PostgreSQL sí siguen snake_case.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  // Campo adicional requerido por el sistema. El valor por defecto es el rol
  // con menos privilegios: si algo falla, el usuario nunca obtiene más acceso.
  role: userRoleEnum("role").default("empleado").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// ---------------------------------------------------------------------------
// Tablas del sistema de empleados
// ---------------------------------------------------------------------------

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
});

export const documentTypes = pgTable("document_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  isRequired: boolean("is_required").default(false).notNull(),
});

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Una cuenta de usuario puede estar vinculada como máximo a un empleado.
    // La restricción unique elimina la ambigüedad al aplicar reglas de acceso
    // (evita que un mismo login consulte varios expedientes a la vez).
    userId: text("user_id")
      .unique()
      .references(() => user.id, { onDelete: "set null" }),
    // Restringimos el borrado del departamento si todavía tiene empleados para
    // no dejar expedientes huérfanos.
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    nationalId: text("national_id").notNull().unique(),
    jobTitle: text("job_title").notNull(),
    hireDate: date("hire_date").notNull(),
    status: employeeStatusEnum("status").default("activo").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("employees_department_id_idx").on(table.departmentId)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Si se elimina un empleado, sus documentos se eliminan en cascada. La
    // limpieza del archivo físico en R2 se hace en el servidor antes de borrar.
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    documentTypeId: uuid("document_type_id")
      .notNull()
      .references(() => documentTypes.id, { onDelete: "restrict" }),
    // Clave aleatoria generada por el servidor. Nunca se usa el nombre original
    // como clave para evitar filtraciones de información y colisiones.
    storageKey: text("storage_key").notNull().unique(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    uploadedBy: text("uploaded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("documents_employee_id_idx").on(table.employeeId),
    index("documents_document_type_id_idx").on(table.documentTypeId),
    index("documents_uploaded_by_idx").on(table.uploadedBy),
    // El dashboard consulta documentos próximos a vencer; este índice evita
    // recorrer toda la tabla cuando el volumen crezca.
    index("documents_expires_at_idx").on(table.expiresAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // El usuario puede eliminarse; conservamos el registro con user_id nulo
    // para no perder la trazabilidad de lo que ocurrió.
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_user_id_idx").on(table.userId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Relaciones
// ---------------------------------------------------------------------------

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  employee: one(employees, {
    fields: [user.id],
    references: [employees.userId],
  }),
  uploadedDocuments: many(documents),
  auditLogs: many(auditLogs),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const departmentRelations = relations(departments, ({ many }) => ({
  employees: many(employees),
}));

export const employeeRelations = relations(employees, ({ one, many }) => ({
  user: one(user, {
    fields: [employees.userId],
    references: [user.id],
  }),
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  documents: many(documents),
}));

export const documentTypeRelations = relations(documentTypes, ({ many }) => ({
  documents: many(documents),
}));

export const documentRelations = relations(documents, ({ one }) => ({
  employee: one(employees, {
    fields: [documents.employeeId],
    references: [employees.id],
  }),
  documentType: one(documentTypes, {
    fields: [documents.documentTypeId],
    references: [documentTypes.id],
  }),
  uploadedByUser: one(user, {
    fields: [documents.uploadedBy],
    references: [user.id],
  }),
}));

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  user: one(user, {
    fields: [auditLogs.userId],
    references: [user.id],
  }),
}));

// ---------------------------------------------------------------------------
// Tipos inferidos
// ---------------------------------------------------------------------------

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type DocumentType = typeof documentTypes.$inferSelect;
export type NewDocumentType = typeof documentTypes.$inferInsert;

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type EmployeeStatus = (typeof employeeStatusEnum.enumValues)[number];
