import { runPosQuery } from "@/lib/supabase-pos/pos-router.ts";
import {
  resolvePaperPrinterDeviceName,
  type PosPrinterLike,
} from "@/lib/pos-printer-routing.ts";

/**
 * Where this paper prints: Print Layout assignment first, then Printers & Devices.
 */
export async function loadPaperPrintDeviceName(args: {
  licenseKey: string;
  templateType: string;
  printers?: PosPrinterLike[];
  templatePrinterId?: string | null;
  fallback?: string;
}): Promise<string | undefined> {
  let printers = args.printers;
  let printerId = args.templatePrinterId;
  try {
    if (!printers) {
      printers = (await runPosQuery("pos.settings.getPrinters", {
        licenseKey: args.licenseKey,
      })) as PosPrinterLike[];
    }
    if (printerId === undefined) {
      const list = (await runPosQuery("pos.templates.listTemplates", {
        licenseKey: args.licenseKey,
      })) as Array<{ templateType?: string; printerId?: string | null }>;
      printerId =
        list?.find((row) => row.templateType === args.templateType)?.printerId ??
        null;
    }
  } catch {
    /* offline / missing table — use fallback */
  }
  const resolved = resolvePaperPrinterDeviceName(
    printers ?? [],
    args.licenseKey,
    printerId,
    args.templateType,
  );
  return resolved || args.fallback?.trim() || undefined;
}
