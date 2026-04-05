import { Module } from '@nestjs/common';

import { modules } from './modules';

@Module({
  imports: [...modules],
  providers: [],
  exports: [],
})
export class CoreModule {}
