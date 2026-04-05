import { Module } from '@nestjs/common';

import { modules } from './modules';
import { services } from './services';

@Module({
  imports: [...modules],
  providers: [...services],
  exports: [...services],
})
export class CoreModule {}
