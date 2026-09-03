import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";

export type JwtPayload = { sub: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireSecret(),
    });
  }

  /**
   * Ce que renvoie cette methode devient `request.user`, et c'est la SEULE
   * source du `userId` utilise par les services. Le client ne transmet jamais
   * son identifiant : c'est ce qui remplace la RLS de Supabase.
   */
  async validate(payload: JwtPayload): Promise<{ userId: string }> {
    // On verifie que le compte existe encore : un jeton reste valable 15 min
    // apres une suppression de compte, ce serait assez pour lire des donnees.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException("Compte introuvable.");
    return { userId: user.id };
  }
}

/**
 * Le secret n'a pas de valeur par defaut, volontairement : demarrer en
 * production avec un secret devine rendrait tous les jetons forgeables.
 */
export function requireSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET manquant ou trop court (32 caracteres minimum). " +
        "Generer avec : node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
    );
  }
  return secret;
}
