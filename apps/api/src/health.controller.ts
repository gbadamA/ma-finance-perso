import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "./auth/public.decorator";
import { PrismaService } from "./prisma/prisma.service";

@ApiTags("0 · Sante")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sonde de sante. Publique et volontairement muette sur le detail : elle sert
   * a Render pour savoir si l'instance repond, pas a diagnostiquer depuis
   * l'exterieur.
   *
   * Le plan gratuit de Render endort le service apres 15 min d'inactivite ; le
   * premier appel qui suit met ~30 s a repondre, le temps du reveil.
   */
  @Public()
  @Get()
  async check(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "up" };
    } catch {
      return { status: "degraded", database: "down" };
    }
  }
}
