import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
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

  // ⚠️ Helmet pose un Content-Security-Policy strict, qui rendrait la page
  // Swagger **entierement blanche** : son interface s'appuie sur des scripts et
  // des styles en ligne. On relache donc le CSP sur cette seule route, plutot
  // que de desactiver helmet partout — les reponses JSON de l'API gardent la
  // protection complete.
  const strict = helmet();
  const pourLaDoc = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://validator.swagger.io"],
      },
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) =>
    (req.path.startsWith("/api/docs") ? pourLaDoc : strict)(req, res, next),
  );
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

  setupDocs(app);

  // Render impose le port par la variable d'environnement.
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
}

/**
 * Documentation interactive, servie sur `/api/docs`.
 *
 * Elle est **active par defaut**, y compris en production : tous les endpoints
 * sont deja proteges par le garde JWT, et le schema est de toute facon public
 * sur GitHub — la masquer n'apporterait qu'une illusion. Poser `DOCS=off`
 * la desactive si le besoin change.
 *
 * ⚠️ `addBearerAuth` est ce qui rend la page utilisable : sans lui, le bouton
 * « Authorize » n'apparait pas et chaque appel authentifie renverrait 401.
 */
function setupDocs(app: INestApplication): void {
  if (process.env.DOCS === "off") return;

  const config = new DocumentBuilder()
    .setTitle("Ma Finance Perso — API")
    .setDescription(
      [
        "Toutes les routes exigent un jeton, sauf `/health` et `/auth/*`.",
        "",
        "**Pour essayer :** `POST /api/auth/register` (ou `/login`), copier le",
        "`accessToken` de la reponse, cliquer **Authorize** en haut a droite et",
        "le coller. Le jeton vit 15 minutes ; passe ce delai, refaire un",
        "`/auth/refresh` avec le `refreshToken`.",
        "",
        "Les montants sont des **entiers, en unite mineure de la devise** :",
        "12 500 F CFA s'ecrit `12500`. Les mois s'ecrivent `AAAA-MM`, les jours",
        "`AAAA-MM-JJ`.",
      ].join("\n"),
    )
    .setVersion("0.1.0")
    .addBearerAuth({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "Coller ici le `accessToken` renvoye par /auth/login.",
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    // Sans cela, le jeton saisi est perdu a chaque rechargement de la page.
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: "Ma Finance Perso — API",
  });
}

void bootstrap();
