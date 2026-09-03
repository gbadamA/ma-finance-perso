import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "../../auth/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";

/** Même plafond que le bucket Supabase d'origine. */
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/**
 * Photos de reçus.
 *
 * ⚠️ **Stockées en base**, pas sur disque. Neon ne fournit que Postgres, et le
 * disque de Render est éphémère : un fichier écrit sur disque disparaît au
 * redéploiement suivant. Le plan gratuit de Neon offre 0,5 Go — à ~1 Mo par
 * reçu, cela laisse quelques centaines de justificatifs. Passé ce cap, il
 * faudra un service d'objets (Cloudflare R2, 10 Go gratuits).
 */
@ApiTags("4 · Recus")
@ApiBearerAuth()
@Controller("receipts")
export class ReceiptsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  // Sans ces deux decorateurs, Swagger presente un champ texte au lieu d'un
  // selecteur de fichier, et le televersement est intestable depuis la page.
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "JPEG, PNG, WebP ou PDF — 5 Mo maximum.",
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES } }))
  async upload(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ id: string }> {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");

    if (!ALLOWED.includes(file.mimetype)) {
      throw new BadRequestException("Format accepté : JPEG, PNG, WebP ou PDF.");
    }

    const receipt = await this.prisma.receipt.create({
      data: {
        userId,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        // `Uint8Array.from` et non le Buffer brut : le type `Buffer` de Node
        // admet un `SharedArrayBuffer` en memoire sous-jacente, que le champ
        // `Bytes` de Prisma refuse. La copie est sans consequence a 5 Mo.
        data: Uint8Array.from(file.buffer),
      },
      select: { id: true },
    });

    return receipt;
  }

  /**
   * Renvoie le fichier.
   *
   * Filtré sur `{ id, userId }` : connaître l'identifiant d'un reçu ne suffit
   * pas à le lire. C'est l'équivalent de la policy de storage qui exigeait que
   * le chemin commence par l'identifiant du propriétaire.
   */
  @Get(":id")
  async download(
    @CurrentUser() userId: string,
    @Param("id") id: string,
    @Res() res: Response,
  ): Promise<void> {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id, userId },
      select: { mimeType: true, data: true },
    });
    if (!receipt) throw new NotFoundException("Reçu introuvable.");

    res.setHeader("Content-Type", receipt.mimeType);
    // `private` : un reçu ne doit jamais finir dans un cache partagé.
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(Buffer.from(receipt.data));
  }
}
