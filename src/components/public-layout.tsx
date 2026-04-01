import { Outlet } from "react-router-dom";
import Navbar from "@/components/navbar.tsx";
import Footer from "@/components/footer.tsx";
import ChatWidget from "@/components/chat-widget.tsx";

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
