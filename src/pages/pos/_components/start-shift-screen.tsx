import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import type { ActiveStaff } from "../_lib/types.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { setStaffOpenShift } from "@/lib/local-db.ts";
import { Banknote, ArrowRight } from "lucide-react";
import { usePosTheme } from "../_lib/use-pos-theme.ts";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

type StartShiftScreenProps = {
  businessName: string;
  licenseKey: string;
  staff: ActiveStaff;
  onShiftStarted: () => void;
};

export default function StartShiftScreen({
  businessName,
  licenseKey,
  staff,
  onShiftStarted,
}: StartShiftScreenProps) {
  const { theme: posTheme } = usePosTheme();
  const [openingCash, setOpeningCash] = useState("");
  const [starting, setStarting] = useState(false);
  const staffList = useQuery("pos.staff.getStaff", { licenseKey });
  const clockIn = useMutation('pos.staff.clockIn');

  const parsedCash = parseFloat(openingCash);
  const isValid = !isNaN(parsedCash) && parsedCash >= 0;

  const handleStart = async () => {
    if (!isValid) return;
    setStarting(true);
    try {
      const syncedStaffId =
        staffList?.find((s) => s._id === (staff.id as unknown as string))?._id ??
        staffList?.find(
          (s) =>
            s.name.trim().toLowerCase() === staff.name.trim().toLowerCase() &&
            s.role === staff.role,
        )?._id;
      if (!syncedStaffId) {
        throw new Error(
          "Staff record is out of sync. Please log out and log in again.",
        );
      }
      await clockIn({
        licenseKey,
        staffId: syncedStaffId as Id<"staff">,
        openingCash: parsedCash,
      });
      try {
        await setStaffOpenShift(licenseKey, String(syncedStaffId), parsedCash);
      } catch (cacheErr) {
        console.warn("[start-shift] failed to cache open shift locally", cacheErr);
      }
      toast.success(
        `Shift started with $${parsedCash.toFixed(2)} opening cash`
      );
      onShiftStarted();
    } catch (err) {
      const convexMsg =
        err instanceof ConvexError &&
        err.data &&
        typeof err.data === "object" &&
        "message" in err.data &&
        typeof (err.data as { message?: unknown }).message === "string"
          ? String((err.data as { message: string }).message)
          : null;
      const fallback =
        err instanceof Error && err.message.trim().length > 0
          ? err.message
          : "Failed to start shift";
      toast.error(convexMsg ?? fallback);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div
      data-pos-theme={posTheme}
      className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center p-4 select-none"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm flex flex-col items-center"
      >
        {/* Logo */}
        <motion.img
          src={LOGO_URL}
          alt="Vyntex POS"
          className="h-14 w-14 mb-4"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15 }}
        />

        {/* Greeting */}
        <p className="text-[#8b93a7] text-sm mb-1">{businessName}</p>
        <p className="text-white text-xl font-bold mb-2">
          Welcome, {staff.name}
        </p>
        <div className="flex items-center gap-2 mb-8">
          <span className="w-2 h-2 rounded-full bg-[#0066FF] animate-pulse" />
          <span className="text-[10px] text-[#0066FF] font-medium uppercase tracking-wider">
            New Shift
          </span>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full rounded-2xl bg-[#131A2E] border border-[#1e2a45] p-6 space-y-5"
        >
          {/* Icon + Title */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#0066FF]/10 flex items-center justify-center">
              <Banknote className="size-6 text-[#0066FF]" />
            </div>
            <div>
              <p className="text-white font-semibold text-base">
                Opening Cash
              </p>
              <p className="text-xs text-[#5a6580]">
                Enter the starting float in the register
              </p>
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a6580] text-xl font-bold">
                $
              </span>
              <Input
                type="number"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isValid) handleStart();
                }}
                placeholder="0.00"
                min={0}
                step={0.01}
                className="bg-[#0A0F1E] border-[#1e2a45] text-white text-2xl font-bold pl-10 py-6 h-auto text-center"
                autoFocus
              />
            </div>

            {/* Quick amount buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[0, 50, 100, 200].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setOpeningCash(String(amount))}
                  className={`py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    parsedCash === amount
                      ? "bg-[#0066FF] text-white"
                      : "bg-[#0A0F1E] text-[#8b93a7] border border-[#1e2a45] hover:border-[#0066FF]/40 hover:text-white"
                  }`}
                >
                  {amount === 0 ? "$0" : `$${amount}`}
                </button>
              ))}
            </div>
          </div>

          {/* Start button */}
          <Button
            onClick={handleStart}
            disabled={!isValid || starting}
            className="w-full bg-[#0066FF] hover:bg-[#0055DD] text-white py-6 text-base font-semibold"
          >
            {starting ? (
              "Starting..."
            ) : (
              <>
                Start Shift
                <ArrowRight className="size-5 ml-2" />
              </>
            )}
          </Button>
        </motion.div>
      </motion.div>

      {/* Footer */}
      <p className="text-[10px] text-[#3a4560] mt-10">Powered by Vyntex POS</p>
    </div>
  );
}
