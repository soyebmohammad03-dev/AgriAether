import { createId } from '../domain/id';
import type { DatasetProvider } from './DatasetProvider';

export type ImportJobStatus = 'PENDING' | 'VALIDATING' | 'INGESTING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ImportJob {
  id: string;
  datasetId: string;
  providerId: string;
  status: ImportJobStatus;
  startedAt: number;
  endedAt: number | null;
  error: string | null;
  recordsProcessed: number;
}

/**
 * Runs an import synchronously through PENDING -> VALIDATING -> INGESTING
 * -> PROCESSING -> COMPLETED/FAILED. `onStatusChange` (optional) is called
 * at each real transition, not a fake progress tick — there is no
 * background worker in this phase, so "progress" only ever reflects a
 * step that has actually happened.
 */
export async function runImportJob(
  provider: DatasetProvider,
  datasetId: string,
  validateAndNormalize: (raw: unknown) => { recordsProcessed: number },
  onStatusChange?: (status: ImportJobStatus) => void
): Promise<ImportJob> {
  const job: ImportJob = {
    id: createId('import_job'),
    datasetId,
    providerId: provider.id,
    status: 'PENDING',
    startedAt: Date.now(),
    endedAt: null,
    error: null,
    recordsProcessed: 0
  };

  const setStatus = (status: ImportJobStatus) => {
    job.status = status;
    onStatusChange?.(status);
  };

  try {
    setStatus('VALIDATING');
    setStatus('INGESTING');
    const raw = await provider.fetch(datasetId);
    setStatus('PROCESSING');
    const { recordsProcessed } = validateAndNormalize(raw);
    job.recordsProcessed = recordsProcessed;
    setStatus('COMPLETED');
  } catch (error) {
    job.error = error instanceof Error ? error.message : String(error);
    setStatus('FAILED');
  } finally {
    job.endedAt = Date.now();
  }

  return job;
}
