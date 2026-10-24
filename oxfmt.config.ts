import { oxfmt, type OxfmtPreset } from '@rhberro/oxsome';
import { defineConfig, type OxfmtConfig } from 'oxfmt';

const base = {
  // Generated assets must keep the exact bytes the generator produced, or the
  // determinism check of the generator fails; the generator formats them.
  ignorePatterns: [
    '*.md',
    'apps/client/public/world/*.json',
    'apps/shared/contracts/city.json',
    'apps/shared/contracts/hunts/*.json',
  ],
};

const config: OxfmtConfig = Object.assign<OxfmtPreset, OxfmtConfig>(oxfmt, base);

export default defineConfig(config);
