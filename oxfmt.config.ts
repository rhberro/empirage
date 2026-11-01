import { oxfmt } from '@rhberro/oxsome';
import type { OxfmtPreset } from '@rhberro/oxsome';
import { defineConfig } from 'oxfmt';
import type { OxfmtConfig } from 'oxfmt';

const base = {
    ignorePatterns: ['*.md'],
  },
  config: OxfmtConfig = Object.assign<OxfmtPreset, OxfmtConfig>(oxfmt, base);

export default defineConfig(config);
