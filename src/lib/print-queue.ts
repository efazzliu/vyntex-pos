import {
  DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS,
  isSilentPrintQueueableError,
  tryPrintHtmlDocumentAsync,
} from "@/lib/print-html.ts";
import {
  enqueuePrintJob,
  getQueuedPrintJobs,
  incrementPrintJobRetry,
  removeQueuedPrintJob,
  type QueuedPrintJob,
} from "@/lib/local-db.ts";

/** How often to retry queued prints (~0.1s). */
const DEFAULT_INTERVAL_MS = 100;
const MAX_PRINT_RETRIES = 200;
const MAX_JOBS_PER_TICK = 10;

let runnerStarted = false;
let isProcessing = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

function getPrintableError(job: QueuedPrintJob, err: unknown): string | undefined {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return job.lastError;
}

export async function enqueueHtmlPrintJob(args: Omit<QueuedPrintJob, "id" | "retries">): Promise<number> {
  return enqueuePrintJob(args);
}

async function processOnePrintJob(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const jobs = await getQueuedPrintJobs();
    if (jobs.length === 0) return;

    for (const job of jobs.slice(0, MAX_JOBS_PER_TICK)) {
      if (job.retries >= MAX_PRINT_RETRIES) {
        console.warn("[POS] print queue: dropping job after max retries", { id: job.id, lastError: job.lastError });
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
        continue;
      }

      await incrementPrintJobRetry(job.id, outcome.error);

      // If the printer is still offline, don't hammer: retry later.
      if (
        isSilentPrintQueueableError(outcome.error) ||
        outcome.error === "no-silent-ipc"
      ) {
        break;
      }
    }
  } catch (e) {
    // Don't crash the runner; retry later.
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
}

/**
 * Starts a background runner that periodically retries queued HTML prints.
 * Call once from `PosApp` on client startup.
 */
export function startPrintQueueRunner(opts?: { intervalMs?: number }): void {
  if (runnerStarted) return;
  runnerStarted = true;

  const interval = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;
  intervalId = setInterval(() => {
    void processOnePrintJob();
  }, interval);

  // Kick immediately.
  void processOnePrintJob();
}

