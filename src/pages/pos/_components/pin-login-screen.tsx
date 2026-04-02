import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { motion } from "motion/react";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import {
  hashString,
  saveStaffCache,
  verifyLocalStaffPin,
  type LocalStaff,
} from "@/lib/local-db.ts";
import type { ActiveStaff } from "../_lib/types.ts";
import { Wifi, WifiOff, Delete } from "lucide-react";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

const NUMPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["clear", "0", "delete"],
] as const;

type PinLoginScreenProps = {
  businessName: string;
  licenseKey: string;
  onLogin: (staff: ActiveStaff) => void;
};

export default function PinLoginScreen({
  businessName,
  licenseKey,
  onLogin,
}: PinLoginScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState<ActiveStaff | null>(null);
  const [verifying, setVerifying] = useState(false);
  const isOnline = useOnlineStatus();

  // Reactively fetch staff list (caches for offline use)
  const staffList = useQuery(api.pos.staff.getStaff, { licenseKey });
  const clockIn = useMutation(api.pos.staff.clockIn);

  // Cache staff in IndexedDB whenever the list updates
  useEffect(() => {
    if (staffList && staffList.length > 0) {
      const cached: LocalStaff[] = staffList.map((s) => ({
        convexId: s._id,
        name: s.name,
        role: s.role,
        pinHash: s.pinHash,
        isActive: s.isActive,
      }));
      saveStaffCache(cached);
    }
  }, [staffList]);

  // Verify the PIN once 4 digits are entered
  const verifyEnteredPin = useCallback(
    async (enteredPin: string) => {
      setVerifying(true);
      setError(false);

      try {
        const pinHash = await hashString(enteredPin);

        // Try against the live list first
        if (staffList) {
          const match = staffList.find(
            (s) => s.pinHash === pinHash && s.isActive
          );
          if (match) {
            const staff: ActiveStaff = {
              id: match._id,
              name: match.name,
              role: match.role,
            };
            setSuccess(staff);

            // Auto clock-in when staff logs in (best-effort, don't block login)
            clockIn({ licenseKey, staffId: match._id }).catch(() => {
              // Silent fail — clock-in is nice-to-have, login still works
            });

            setTimeout(() => onLogin(staff), 800);
            return;
          }
        } else {
          // Offline fallback: check IndexedDB cache
          const localMatch = await verifyLocalStaffPin(pinHash);
          if (localMatch) {
            const staff: ActiveStaff = {
              id: localMatch.convexId,
              name: localMatch.name,
              role: localMatch.role,
            };
            setSuccess(staff);
            setTimeout(() => onLogin(staff), 800);
            return;
          }
        }

        // No match found
        setError(true);
        setTimeout(() => {
          setPin("");
          setError(false);
        }, 1000);
      } finally {
        setVerifying(false);
      }
    },
    [staffList, onLogin, clockIn, licenseKey]
  );

  // Auto-verify when 4 digits are entered
  useEffect(() => {
    if (pin.length === 4 && !verifying && !success) {
      verifyEnteredPin(pin);
    }
  }, [pin, verifying, success, verifyEnteredPin]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (verifying || success) return;

      if (key === "clear") {
        setPin("");
        setError(false);
        return;
      }

      if (key === "delete") {
        setPin((prev) => prev.slice(0, -1));
        setError(false);
        return;
      }

      setPin((prev) => {
        if (prev.length >= 4) return prev;
        return prev + key;
      });
    },
    [verifying, success]
  );

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center p-4 select-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xs flex flex-col items-center"
      >
        {/* Logo & business name */}
        <motion.img
          src={LOGO_URL}
          alt="VYNTEX"
          className="h-14 w-14 mb-3"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15 }}
        />
        <p className="text-[#8b93a7] text-sm mb-1">{businessName}</p>

        {/* Online / Offline indicator */}
        <div className="flex items-center gap-1.5 mb-8">
          {isOnline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Wifi className="size-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
                Online
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <WifiOff className="size-3 text-amber-400" />
              <span className="text-[10px] text-amber-400 font-medium uppercase tracking-wider">
                Offline
              </span>
            </>
          )}
        </div>

        {/* Title */}
        <p className="text-white text-lg font-semibold mb-6">
          {success ? `Welcome, ${success.name}` : "Enter your PIN"}
        </p>

        {/* PIN dots */}
        <div className="flex gap-4 mb-10">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="w-4 h-4 rounded-full transition-colors duration-200"
              style={{
                backgroundColor: success
                  ? "#44CC00"
                  : error
                    ? "#ef4444"
                    : pin.length > i
                      ? "#0066FF"
                      : "#1e2a45",
              }}
              animate={
                error
                  ? { x: [0, -6, 6, -6, 6, 0] }
                  : success
                    ? { scale: [1, 1.3, 1] }
                    : {}
              }
              transition={{ duration: 0.4 }}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 text-xs mb-4 font-medium"
          >
            Invalid PIN. Try again.
          </motion.p>
        )}

        {/* Numpad */}
        <div className="flex flex-col gap-3">
          {NUMPAD_KEYS.map((row, ri) => (
            <div key={ri} className="flex gap-3 justify-center">
              {row.map((key) => {
                const isAction = key === "clear" || key === "delete";
                return (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    disabled={verifying || !!success}
                    className={`w-20 h-14 rounded-2xl font-semibold text-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                      isAction
                        ? "bg-[#1e2a45]/60 text-[#8b93a7] hover:bg-[#1e2a45]"
                        : "bg-[#131A2E] text-white hover:bg-[#1e2a45] border border-[#1e2a45]"
                    }`}
                  >
                    {key === "delete" ? (
                      <Delete className="size-5 mx-auto" />
                    ) : key === "clear" ? (
                      <span className="text-base">C</span>
                    ) : (
                      key
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Footer */}
      <p className="text-[10px] text-[#3a4560] mt-10">
        Powered by VYNTEX
      </p>
    </div>
  );
}
