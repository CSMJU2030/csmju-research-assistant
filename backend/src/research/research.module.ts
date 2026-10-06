import { Module } from "@nestjs/common";
import { CoreHubModule } from "../core-hub/core-hub.module";
import { ResearchController } from "./research.controller";
import { ResearchService } from "./research.service";
@Module({
  imports: [CoreHubModule],
  controllers: [ResearchController],
  providers: [ResearchService],
})
export class ResearchModule {}
