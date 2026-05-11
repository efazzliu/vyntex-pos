import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button.tsx";
import { usePosLocale } from "./pos-locale-provider.tsx";

type Props = { children: ReactNode };

type State = { error: Error | null };

/**
 * Catches render errors in POS workspace views. Without this, React unmounts
 * the tree and the shell (`bg-[#0A0F1E]`) looks like a full black screen.
 */
export class PosViewErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[POS] view render error:", error.message, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <PosViewErrorFallback
          errorMessage={this.state.error.message}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

function PosViewErrorFallback({
  errorMessage,
  onRetry,
}: {
  errorMessage: string;
  onRetry: () => void;
}) {
  const { t } = usePosLocale();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-base font-semibold text-white">{t("pos_view.crash_title")}</p>
      <p className="text-sm text-[#8b93a7] max-w-md">{t("pos_view.crash_body")}</p>
      {import.meta.env.DEV ? (
        <pre className="max-w-full overflow-auto rounded-lg bg-black/40 p-3 text-left text-xs text-red-300/90">
          {errorMessage}
        </pre>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          onClick={onRetry}
          className="bg-[#0066FF] text-white hover:bg-[#0052cc]"
        >
          {t("btn.retry")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            window.location.reload();
          }}
          className="border-[#1e2a45] bg-[#131A2E] text-white hover:bg-[#1e2a45]"
        >
          {t("pos_view.reload_app")}
        </Button>
      </div>
    </div>
  );
}
