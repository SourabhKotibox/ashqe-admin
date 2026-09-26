import { useLocation } from "wouter";
import { SignInModal } from "./streaming-home";

export default function PublicAuthPage() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-[#030306] flex items-center justify-center p-4">
      <SignInModal onClose={() => navigate("/")} />
    </div>
  );
}
