import { createRoot } from "react-dom/client";
import "../index.css";
import PhoneApp from "./PhoneApp.tsx";

/** Block iOS Safari pinch-zoom gestures inside the phone shell. */
function disablePhoneZoomGestures() {
  const block = (event: Event) => {
    event.preventDefault();
  };
  document.addEventListener("gesturestart", block, { passive: false });
  document.addEventListener("gesturechange", block, { passive: false });
  document.addEventListener("gestureend", block, { passive: false });
}

disablePhoneZoomGestures();

createRoot(document.getElementById("root")!).render(<PhoneApp />);
