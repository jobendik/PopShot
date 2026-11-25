import { Globo } from './globo';
import { Volta } from './volta';
import { Rift } from './rift';
import type { Boss, BossKind } from './base';

export { Boss, type BossKind } from './base';

export function createBoss(kind: BossKind): Boss {
  if (kind === 'globo') return new Globo();
  if (kind === 'volta') return new Volta();
  return new Rift();
}
