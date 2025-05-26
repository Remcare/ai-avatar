import React from "react";
import { Button } from "@nextui-org/react";

const Session = ({ endSession,handleInterrupt,handleDownload}) => {

  return (
    <div className="flex flex-col gap-2 pr-4 items-start justify-start">
                <Button
                  color="success"
                  size="md"
                  onPress={handleInterrupt}
                >
                  Interrupt task
                </Button>
                <Button
                  color="success"
                  size="md"
                  onPress={endSession}
                >
                  End session
                </Button>

                      {/* Download Transcription Button */}
      <Button
        color="success"
        auto
        onPress={handleDownload}
      >
        See Transcription
      </Button>
    </div>
  );
};

export default Session;
