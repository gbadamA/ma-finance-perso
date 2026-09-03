import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/current-user.decorator";
import { SnapshotService } from "./snapshot.service";

@ApiTags("2 · Lecture")
@ApiBearerAuth()
@Controller("snapshot")
export class SnapshotController {
  constructor(private readonly snapshot: SnapshotService) {}

  /** Tout le dossier financier en un appel — cf. l'en-tete du service. */
  @Get()
  get(@CurrentUser() userId: string) {
    return this.snapshot.forUser(userId);
  }
}
