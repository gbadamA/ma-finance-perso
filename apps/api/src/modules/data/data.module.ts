import { Module } from "@nestjs/common";
import { DataController } from "./data.controller";
import { DataService } from "./data.service";
import { SnapshotController } from "../snapshot/snapshot.controller";
import { SnapshotService } from "../snapshot/snapshot.service";

@Module({
  controllers: [DataController, SnapshotController],
  providers: [DataService, SnapshotService],
})
export class DataModule {}
