import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Ouvre une route sans jeton. A n'utiliser que sur l'authentification :
 * le garde est global, donc oublier ce decorateur ferme la route — c'est le
 * sens de defaillance voulu (fermer par defaut, ouvrir explicitement).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
