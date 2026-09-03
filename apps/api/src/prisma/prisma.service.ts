import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Acces a la base.
 *
 * Prisma 7 ne lit plus l'URL depuis `schema.prisma` : le client la recoit par
 * un **adaptateur**. On utilise `@prisma/adapter-pg` — un pool `pg` classique —
 * et non l'adaptateur HTTP serverless de Neon : l'API tourne dans un processus
 * Node durable sur Render, ou un pool de connexions est le bon modele.
 *
 * ⚠️ Renseigner la chaine **pooled** de Neon (`...-pooler...`) : Render peut
 * lancer plusieurs instances, et des connexions directes epuiseraient vite le
 * quota du plan gratuit.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL manquante — voir apps/api/.env.example.");
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
