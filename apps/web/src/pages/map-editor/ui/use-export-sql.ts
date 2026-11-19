/* eslint-disable oxsome/no-inline-structural-types */
import { useState } from 'react';

import type {
  HuntingLocation,
  HuntingLocationMap,
  HuntingLocationSpecies,
  HuntingLocationWaveRange,
} from '~/entities/hunting-location';

import { generateHuntingLocationSeedSql } from './seed-export-logic';

export interface UseExportSqlParams {
  configuredSpecies: Array<HuntingLocationSpecies>;
  configuredWaveRanges: Array<HuntingLocationWaveRange>;
  currentMap: HuntingLocationMap;
  locations: Array<HuntingLocation>;
  selectedLocationId: number | null;
  selectedTilesetUrl: string;
}

export interface UseExportSqlResult {
  exportSql: string;
  handleCloseExportModal: () => void;
  handleOpenExportModal: () => void;
  isExportModalOpen: boolean;
}

export function useExportSql(params: UseExportSqlParams): UseExportSqlResult {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportSql, setExportSql] = useState('');

  function handleOpenExportModal(): void {
    function matchLoc(l: HuntingLocation): boolean {
      return l.id === params.selectedLocationId;
    }
    const loc = params.locations.find(matchLoc);
    if (!loc) {
      return;
    }
    const sql = generateHuntingLocationSeedSql(
      loc,
      params.currentMap,
      params.selectedTilesetUrl,
      params.configuredSpecies,
      params.configuredWaveRanges,
    );
    setExportSql(sql);
    setIsExportModalOpen(true);
  }

  function handleCloseExportModal(): void {
    setIsExportModalOpen(false);
  }

  return {
    exportSql,
    handleCloseExportModal,
    handleOpenExportModal,
    isExportModalOpen,
  };
}
