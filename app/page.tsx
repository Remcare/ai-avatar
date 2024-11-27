"use client";
import InteractiveAvatar from "@/components/InteractiveAvatar";

export default function App() {
  return (
    <div className="w-screen h-screen flex flex-col">
      {/* Navigation Bar with #41C5D1 color */}
      <nav className="w-full bg-[#41C5D1] p-4">
      <img
          src="F:\ai-avatar-dev\app\remcare.jpg"  // Update this path to your image
          alt="Logo"
          className="mx-auto h-10" // Adjust size as needed
        />
      </nav>

      <div className="w-[900px] flex flex-col items-center justify-center gap-5 mx-auto h-full">
        <div className="w-full">
          <InteractiveAvatar />
        </div>
      </div>
    </div>
  );
}
