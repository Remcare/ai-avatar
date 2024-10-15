"use client";

import InteractiveAvatar from "@/components/InteractiveAvatar";
export default function App() {
  return (
    <div className="w-screen h-screen flex flex-col">
      <div className="w-[900px] flex flex-col items-center justify-center gap-5 mx-auto h-full">
        <div className="w-full">
          <InteractiveAvatar />
        </div>
      </div>
    </div>
  );
}
