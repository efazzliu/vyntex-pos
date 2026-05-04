import { Outlet } from "react-router-dom";
import Navbar from "@/components/navbar.tsx";
import Footer from "@/components/footer.tsx";
import ChatWidget from "@/components/chat-widget.tsx";

export default function PublicLayout() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Soft brand wash so pages are not flat #fff; stays behind content */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-44 left-1/2 h-[min(32rem,90vw)] w-[min(56rem,100%)] -translate-x-1/2 rounded-full bg-[#0066FF]/[0.075] blur-[100px]" />
        <div className="absolute top-[22%] -right-20 h-72 w-72 rounded-full bg-[#44CC00]/[0.055] blur-[88px] md:h-80 md:w-80" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-muted/50 to-transparent" />
      </div>
      <Navbar />
      <main className="relative flex-1">
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
