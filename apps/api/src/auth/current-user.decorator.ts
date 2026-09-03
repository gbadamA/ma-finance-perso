import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

/**
 * Injecte l'identifiant de l'utilisateur authentifie, extrait du JWT par
 * `JwtStrategy.validate`. C'est le seul moyen legitime d'obtenir un `userId`
 * dans un controleur — ne jamais le lire depuis le corps ou l'URL.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ user?: { userId?: string } }>();
    const userId = request.user?.userId;
    if (!userId) throw new Error("CurrentUser utilise sur une route non protegee.");
    return userId;
  },
);
