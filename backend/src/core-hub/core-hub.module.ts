import { Module } from '@nestjs/common';
import { ReferenceDataEventsLogger } from './reference-data-events.logger';
import { ReferenceDataService } from './reference-data.service';

/**
 * ข้อมูลอ้างอิงจาก Core Hub — import module นี้ใน module ที่ต้องใช้
 * แล้ว inject ReferenceDataService (ต้องมี ConfigModule แบบ global อยู่แล้ว)
 */
@Module({
  providers: [ReferenceDataEventsLogger, ReferenceDataService],
  exports: [ReferenceDataService],
})
export class CoreHubModule {}
