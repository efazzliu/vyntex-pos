import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, LayoutGrid } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";

const DEMO_VIDEO_SRC = "/videos/vyntex-pos-demo.mp4";

export default function DemoVideoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("site");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden border-[#1e2a45] bg-[#0A0F1E] p-0 text-white sm:rounded-2xl [&_[data-slot=dialog-close]]:text-white/70 [&_[data-slot=dialog-close]]:hover:text-white">
        <DialogHeader className="px-5 pt-5 sm:px-6">
          <DialogTitle className="text-lg text-white">{t("demoVideo.title")}</DialogTitle>
          <DialogDescription className="text-[#8b93a7]">
            {t("demoVideo.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 sm:px-6">
          <div className="overflow-hidden rounded-xl border border-[#1e2a45] bg-black">
            <video
              key={open ? "playing" : "idle"}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="aspect-video w-full"
              src={DEMO_VIDEO_SRC}
            >
              {t("demoVideo.fallback")}
            </video>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-[#5a6580]">{t("demoVideo.tryHint")}</p>
          <Button
            asChild
            variant="outline"
            className="h-9 rounded-lg border-[#1e2a45] bg-transparent text-white hover:bg-white/10"
            onClick={() => onOpenChange(false)}
          >
            <Link to="/product-demo" className="inline-flex items-center">
              <LayoutGrid className="mr-2 size-4" />
              {t("demoVideo.tryButton")}
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
