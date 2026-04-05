import { configModule } from './config.module';
import { eventEmitterModule } from './event-emitter.module';
import { typeormForRoot } from './typeorm.module';

export const modules = [configModule, eventEmitterModule, typeormForRoot];
