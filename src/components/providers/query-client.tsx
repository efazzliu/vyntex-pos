import {
  QueryClient,
  QueryClientProvider as ReactQueryClientProvider,
} from "@tanstack/react-query";

export const queryClient = new QueryClient();

export function QueryClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ReactQueryClientProvider client={queryClient}>
      {children}
    </ReactQueryClientProvider>
  );
}
