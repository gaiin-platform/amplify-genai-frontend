import { describe, expect, it } from 'vitest';
import {
  AdminConfigTypes,
  adminDataTabMap,
  documentRetentionDaysAreValid,
} from '@/types/admin';

describe('document retention setting', () => {
  it('accepts only whole days from 1 to 3650', () => {
    [1, 30, 90, 3650].forEach((days) => expect(documentRetentionDaysAreValid(days)).toBe(true));
    [0, -1, 3651, 12.5, NaN, Infinity, '90', null, undefined].forEach((days) =>
      expect(documentRetentionDaysAreValid(days)).toBe(false),
    );
  });

  it('is a saved admin config shown on the Configurations tab', () => {
    expect(AdminConfigTypes.DOCUMENT_RETENTION).toBe('documentRetention');
    expect(adminDataTabMap['Configurations']).toContain(AdminConfigTypes.DOCUMENT_RETENTION);
  });
});
