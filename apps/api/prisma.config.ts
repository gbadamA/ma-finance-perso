import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Configuration Prisma 7.
 *
 * Depuis la version 7, l'URL de connexion ne vit plus dans `schema.prisma` :
 * les commandes de migration la lisent ici, et le client applicatif la recoit
 * via un adaptateur (`src/prisma/prisma.service.ts`).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
