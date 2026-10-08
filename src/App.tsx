import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./chrome/AppShell";
import { ChaaviPage } from "./pages/ChaaviPage";
import { GharPage } from "./pages/GharPage";
import { HathPage } from "./pages/HathPage";
import { SystemPage } from "./pages/SystemPage";
import { TimelinePage } from "./pages/TimelinePage";
import { WidgetGridPage } from "./pages/WidgetGridPage";
import { YaadPage } from "./pages/YaadPage";
import { pushToast } from "./store/toasts";

/** Every failed action (a toggle, a save, a send through a mutation) toasts its real error, folded per message. */
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (err) => {
      pushToast({ key: `mutation:${err.message}`, tone: "error", title: "Action failed", body: err.message });
    },
  }),
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<WidgetGridPage />} />
            <Route path="hath" element={<HathPage />} />
            <Route path="yaad" element={<YaadPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="calendar" element={<Navigate to="/timeline" replace />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="chaavi" element={<ChaaviPage />} />
            <Route path="ghar" element={<GharPage />} />
            <Route path="logs" element={<Navigate to="/system" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
