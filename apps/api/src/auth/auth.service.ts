import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { seedNewUser } from "./seed-new-user";

/** Durée de vie du jeton d'accès. Court : il n'est pas révocable. */
const ACCESS_TTL = "15m";
/** Durée de vie du jeton de rafraîchissement, lui révocable en base. */
const REFRESH_TTL_DAYS = 60;

export type Tokens = { accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string): Promise<Tokens> {
    const normalised = email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email: normalised },
    });
    if (existing) throw new ConflictException("Un compte existe déjà avec cet e-mail.");

    const user = await this.prisma.user.create({
      data: { email: normalised, passwordHash: await argon2.hash(password) },
    });

    // Amorçage : catégories, sources de revenus, allocation cible, comptes et
    // checklist. Sans cela le premier écran est un formulaire de création de
    // catégories — exactement la friction que l'app supprime.
    await seedNewUser(this.prisma, user.id);

    return this.issueTokens(user.id);
  }

  async login(email: string, password: string): Promise<Tokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // Message identique qu'il s'agisse d'un e-mail inconnu ou d'un mauvais mot
    // de passe : distinguer les deux permettrait d'énumérer les comptes.
    const invalid = new UnauthorizedException("E-mail ou mot de passe incorrect.");
    if (!user) {
      // On hache quand même, pour que la réponse mette le même temps qu'un
      // compte existant — sinon la latence trahit l'existence du compte.
      await argon2.hash(password);
      throw invalid;
    }

    if (!(await argon2.verify(user.passwordHash, password))) throw invalid;

    return this.issueTokens(user.id);
  }

  /**
   * Échange un jeton de rafraîchissement contre une nouvelle paire.
   *
   * L'ancien est supprimé au passage (rotation) : un jeton volé ne sert qu'une
   * fois, et sa réutilisation échoue — ce qui rend le vol détectable.
   */
  async refresh(refreshToken: string): Promise<Tokens> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expirée, reconnectez-vous.");
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    return this.issueTokens(stored.userId);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken
      .delete({ where: { tokenHash: hashToken(refreshToken) } })
      .catch(() => {
        // Jeton déjà absent : la session est fermée, c'est le résultat voulu.
      });
  }

  private async issueTokens(userId: string): Promise<Tokens> {
    const accessToken = await this.jwt.signAsync({ sub: userId }, { expiresIn: ACCESS_TTL });

    // Aléatoire opaque plutôt qu'un JWT : un jeton de rafraîchissement n'a
    // aucune information à porter, et le stocker haché suffit à le valider.
    const refreshToken = randomBytes(48).toString("base64url");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashToken(refreshToken), expiresAt },
    });

    return { accessToken, refreshToken };
  }
}

/**
 * Les jetons de rafraîchissement sont stockés hachés : une fuite de la base ne
 * doit pas permettre de rouvrir les sessions. SHA-256 suffit ici — la valeur
 * est déjà 48 octets aléatoires, elle n'a pas besoin d'un hachage lent.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
