import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class CredentialsDto {
  @IsEmail({}, { message: "Adresse e-mail invalide." })
  email!: string;

  // 8 caracteres minimum : le cahier des charges impose un hachage fort, une
  // longueur trop courte le rendrait sans effet face a une attaque par
  // dictionnaire. La borne haute evite un deni de service par hachage argon2.
  @IsString()
  @MinLength(8, { message: "Le mot de passe doit faire au moins 8 caracteres." })
  @MaxLength(128)
  password!: string;
}

/**
 * Connexion — volontairement PLUS PERMISSIF que `CredentialsDto`.
 *
 * Appliquer la longueur minimale ici renverrait 400 (« mot de passe trop
 * court ») au lieu de 401 pour une saisie erronee, et court-circuiterait la
 * comparaison a temps constant de `login`. Pire : si la regle se durcit un
 * jour, un compte cree sous l'ancienne regle ne pourrait plus se connecter du
 * tout. La longueur se verifie a l'inscription, pas a la connexion.
 */
export class LoginDto {
  @IsEmail({}, { message: "Adresse e-mail invalide." })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: "Mot de passe requis." })
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
