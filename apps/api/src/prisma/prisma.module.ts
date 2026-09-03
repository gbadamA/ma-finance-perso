import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/** Global : chaque module métier a besoin de Prisma, l'importer partout est du bruit. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
