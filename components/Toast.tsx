import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const visibilityTimer = setTimeout(() => {
      setIsVisible(false);
    }, 2700); // Start fading out slightly before the 3-second mark

    const dismissTimer = setTimeout(() => {
      onDismiss();
    }, 3000);

    return () => {
      clearTimeout(visibilityTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  return (
    <div
      className={`fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      {message}
    </div>
  );
}
