import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";

/**
 * Prisma renvoie les montants en `BigInt` (unité mineure de la devise), et
 * `JSON.stringify` refuse de sérialiser un BigInt. On l'apprend ici, une fois
 * pour toutes, plutôt que de convertir dans chaque service.
 *
 * `Number` est sûr : les montants restent très en deçà de 2^53, même en francs
 * CFA entiers — 9 007 199 254 740 991 F, soit neuf millions de milliards.
 */
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (
  this: bigint,
) {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.setGlobalPrefix("api");

  // L'app mobile n'a pas d'origine : `origin: true` couvre les appels natifs
  // comme un futur front web sans lister les domaines un par un.
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Rejette au lieu d'ignorer : un champ inconnu signale un client
      // desynchronise de l'API, mieux vaut le savoir tout de suite.
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Render impose le port par la variable d'environnement.
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
