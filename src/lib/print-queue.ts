import {
  DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS,
  canAttemptSilentPrint,
  hasElectronSilentPrintIpc,
  isSilentPrintQueueableError,
  tryPrintHtmlDocumentAsync,
} from "@/lib/print-html.ts";
import {
  clearPrintQueue,
  enqueuePrintJob,
  getPrintQueueCount,
  getQueuedPrintJobs,
  incrementPrintJobRetry,
  removeQueuedPrintJob,
  type QueuedPrintJob,
} from "@/lib/local-db.ts";

const MAX_PRINT_RETRIES = 200;
const MAX_JOBS_PER_FLUSH = 10;

let runnerStarted = false;
let isProcessing = false;

function getPrintableError(job: QueuedPrintJob, err: unknown): string | undefined {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return job.lastError;
}

export async function enqueueHtmlPrintJob(args: Omit<QueuedPrintJob, "id" | "retries">): Promise<number> {
  return enqueuePrintJob(args);
}

/**
 * Process queued HTML prints once (manual or after a successful on-demand print).
 * Does not run on a timer — background retries were opening Windows
 * "Waiting for printer connection…" every few seconds when the printer was offline.
 */
export async function flushPrintQueueNow(): Promise<{ sent: number; failed: number }> {
  if (isProcessing) return { sent: 0, failed: 0 };
  if (!(await canAttemptSilentPrint())) {
    return { sent: 0, failed: 0 };
  }

  isProcessing = true;
  let sent = 0;
  let failed = 0;
  try {
    const jobs = await getQueuedPrintJobs();
    for (const job of jobs.slice(0, MAX_JOBS_PER_FLUSH)) {
      if (job.retries >= MAX_PRINT_RETRIES) {
        await removeQueuedPrintJob(job.id);
        continue;
      }

      const outcome = await tryPrintHtmlDocumentAsync(job.html, {
        silent: job.silent,
        allowInteractiveFallback: job.allowInteractiveFallback,
        deviceName: job.deviceName,
        silentTimeoutMs: DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS,
      });

      if (outcome.ok) {
        await removeQueuedPrintJob(job.id);
        sent += 1;
        continue;
      }

      await incrementPrintJobRetry(job.id, outcome.error);
      failed += 1;

      if (
        isSilentPrintQueueableError(outcome.error) ||
        outcome.error === "no-silent-ipc"
      ) {
        break;
      }
    }
  } catch (e) {
    try {
      const jobs = await getQueuedPrintJobs();
      if (jobs.length > 0) {
        await incrementPrintJobRetry(jobs[0].id, getPrintableError(jobs[0], e));
      }
    } catch {
      /* ignore */
    }
  } finally {
    isProcessing = false;
  }

  return { sent, failed };
}

/**
 * Call once from `PosApp` on startup. Does not poll the OS printer in the background.
 */
export async function initPrintQueueOnStartup(): Promise<void> {
  if (runnerStarted) return;
  runnerStarted = true;

  if (!hasElectronSilentPrintIpc()) return;

  const pending = await getPrintQueueCount();
  if (pending > 0) {
    await clearPrintQueue();
  }
}

/** @deprecated Use initPrintQueueOnStartup — no background interval anymore. */
export function startPrintQueueRunner(): void {
  void initPrintQueueOnStartup();
}
