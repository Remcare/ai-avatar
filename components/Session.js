import React from "react";
import { Button } from "@nextui-org/react";

const Session = ({ endSession,handleInterrupt,handleDownload}) => {

  return (
    <div className="flex flex-col gap-2 pr-4 items-start justify-start">
      
                      {/* Download Transcription Button */}
                      <Button
        color="success"
        auto
        onPress={handleDownload}
      >
        Download Transcription
      </Button>
                <Button
                  color="success"
                  size="md"
                  onPress={handleInterrupt}
                >
                  Interrupt Avatar
                </Button>
                <Button
                  color="success"
                  size="md"
                  onPress={endSession}
                >
                  End session
                </Button>
    </div>
  );
};

export default Session;
