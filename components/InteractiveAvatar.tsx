import type { StartAvatarResponse } from "@heygen/streaming-avatar";

import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskType,
  VoiceEmotion,
} from "@heygen/streaming-avatar";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Divider,
  Select,
  SelectItem,
  Spinner,
  Chip,
  Tabs,
  Tab,
} from "@nextui-org/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useMemoizedFn, usePrevious } from "ahooks";

import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";

import { AVATARS, STT_LANGUAGE_LIST } from "@/app/lib/constants";

export default function InteractiveAvatar() {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>();
  const [avatarId, setAvatarId] = useState<string>("");
  const [language, setLanguage] = useState<string>("en");
  const [data, setData] = useState<StartAvatarResponse>();
  const [text, setText] = useState<string>("");
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatar | null>(null);
  const [chatMode, setChatMode] = useState("text_mode");
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(
    null
  );
  const audioChunks = useRef<Blob[]>([]);

  const [overlayText, setOverlayText] = useState<string | null>(null);
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();

      console.log("Access Token:", token); // Log the token to verify

      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
    }

    return "";
  }

  async function startSession() {
    setIsLoadingSession(true);
    const newToken = await fetchAccessToken();

    avatar.current = new StreamingAvatar({
      token: newToken,
    });
    avatar.current.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
      console.log("Avatar started talking", e);
    });
    avatar.current.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
      console.log("Avatar stopped talking", e);
    });
    avatar.current.on(StreamingEvents.STREAM_DISCONNECTED, () => {
      console.log("Stream disconnected");
      endSession();
    });
    avatar.current?.on(StreamingEvents.STREAM_READY, (event) => {
      console.log(">>>>> Stream ready:", event.detail);
      setStream(event.detail);
      setIsLoadingSession(false);
    });
    avatar.current?.on(StreamingEvents.USER_START, (event) => {
      console.log(">>>>> User started talking:", event);
      setIsUserTalking(true);
    });
    avatar.current?.on(StreamingEvents.USER_STOP, (event) => {
      console.log(">>>>> User stopped talking:", event);
      setIsUserTalking(false);
    });
    try {
      const res = await avatar.current.createStartAvatar({
        quality: AvatarQuality.Low,
        avatarName: avatarId,
        knowledgeId: "bb77e29751334e21b1ea609fb8223bc3", // custom remcare knowledge.
        voice: {
          rate: 1.5, // 0.5 ~ 1.5
          emotion: VoiceEmotion.EXCITED,
        },
        language: language,
      });

      setData(res);
      setChatMode("voice_mode");
    } catch (error) {
      console.error("Error starting avatar session:", error);
      setIsLoadingSession(false);
    }
  }
  const handleSpeak = async (inputText: string) => {
    console.log("Handling speak with text:", inputText);
    setIsLoadingRepeat(true);
    if (!avatar.current) {
      console.warn("Avatar API not initialized");
      setDebug("Avatar API not initialized");
      return;
    }
    try {
      setOverlayText(inputText);
      // Clear previous timeout if it exists
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }

      // Set a new timeout to clear the overlay text after 3 seconds
      overlayTimeoutRef.current = setTimeout(() => {
        setOverlayText(null);
      }, 3000);

      // First, get AI response from chat endpoint
      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: inputText }),
      });

      if (!chatResponse.ok) {
        throw new Error("Chat request failed");
      }

      const { response: aiResponse } = await chatResponse.json();
      console.log("Chat API response:", aiResponse);

      // Then, have avatar speak the AI response
      const response = await avatar.current.speak({
        text: aiResponse,
        task_type: TaskType.REPEAT,
      });
      console.log("Avatar speak response:", response);
    } catch (e: any) {
      console.error("Error in avatar speak:", e);
      setDebug(`Error in avatar speak: ${e.message}`);
    } finally {
      setIsLoadingRepeat(false);
    }
  };
  async function handleInterrupt() {
    if (!avatar.current) {
      setDebug("Avatar API not initialized");

      return;
    }
    await avatar.current.interrupt().catch((e) => {
      setDebug(e.message);
    });
  }
  async function endSession() {
    await avatar.current?.stopAvatar();
    setStream(undefined);
  }

  const startRecording = useCallback(async () => {
    console.log("Starting recording...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Got audio stream:", stream);
      const recorder = new MediaRecorder(stream);
      setAudioRecorder(recorder);

      recorder.ondataavailable = (event) => {
        console.log("Audio data available:", event.data);
        audioChunks.current.push(event.data);
      };

      recorder.onstop = async () => {
        console.log("Recording stopped. Processing audio...");
        const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
        console.log("Audio blob created:", audioBlob);
        await sendAudioForTranscription(audioBlob);
        audioChunks.current = [];
      };

      recorder.start();
      setIsRecording(true);
      console.log("Recording started successfully");
    } catch (error) {
      console.error("Error starting recording:", error);
      setDebug("Error starting recording");
    }
  }, []);

  const stopRecording = useCallback(() => {
    console.log("Stopping recording...");
    if (audioRecorder) {
      audioRecorder.stop();
      setIsRecording(false);
      console.log("Recording stopped");
    } else {
      console.warn("No active recorder to stop");
    }
  }, [audioRecorder]);

  const sendAudioForTranscription = async (audioBlob: Blob) => {
    console.log("Sending audio for transcription...");
    const formData = new FormData();
    formData.append("audio", audioBlob, "speech.wav");

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Transcription failed");
      }

      const { text } = await response.json();
      console.log("Transcription result:", text);

      // Now just pass the transcribed text to handleSpeak
      await handleSpeak(text);
    } catch (error) {
      console.error("Error in audio processing:", error);
      setDebug("Error processing audio");
    }
  };

  const handleChangeChatMode = useMemoizedFn(async (v) => {
    console.log("Changing chat mode to:", v);
    if (v === chatMode) {
      console.log("Chat mode unchanged");
      return;
    }
    if (v === "text_mode") {
      console.log("Switching to text mode, stopping recording if active");
      stopRecording();
    }
    setChatMode(v);
    console.log("Chat mode changed successfully");
  });

  const previousText = usePrevious(text);
  useEffect(() => {
    if (!previousText && text) {
      avatar.current?.startListening();
    } else if (previousText && !text) {
      avatar?.current?.stopListening();
    }
  }, [text, previousText]);

  useEffect(() => {
    return () => {
      endSession();
    };
  }, []);

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
        setDebug("Playing");
      };
    }
  }, [mediaStream, stream]);

  useEffect(() => {
    console.log("Current chat mode:", chatMode);
    console.log("Is recording:", isRecording);
    console.log("Current text:", text);
  }, [chatMode, isRecording, text]);

  // Clean up the timeout on component unmount
  useEffect(() => {
    return () => {
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <Card>
        <CardBody className="h-[500px] flex flex-col justify-center items-center">
          {stream ? (
            <div className="relative h-[500px] w-[900px] justify-center items-center flex rounded-lg overflow-hidden">
              <video
                ref={mediaStream}
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              >
                <track kind="captions" />
              </video>
              <div
                className={`absolute w-1/2 bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white p-2 text-center transition-opacity duration-2000 ease-in-out ${
                  overlayText !== null ? "opacity-100" : "opacity-0"
                }`}
              >
                {overlayText}
              </div>
              <div className="flex flex-col gap-2 absolute bottom-3 right-3">
                <Button
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white rounded-lg"
                  size="md"
                  variant="shadow"
                  onClick={handleInterrupt}
                >
                  Interrupt task
                </Button>
                <Button
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300  text-white rounded-lg"
                  size="md"
                  variant="shadow"
                  onClick={endSession}
                >
                  End session
                </Button>
              </div>
            </div>
          ) : !isLoadingSession ? (
            <div className="h-full justify-center items-center flex flex-col gap-8 w-[500px] self-center">
              <div className="flex flex-col gap-2 w-full">
                <p className="text-sm font-medium leading-none">
                  Select Custom Avatar (optional)
                </p>
                <Select
                  placeholder="Select one from these example avatars"
                  size="md"
                  selectedKeys={[avatarId]}
                  onChange={(e) => {
                    setAvatarId(e.target.value);
                  }}
                >
                  {AVATARS.map((avatar) => (
                    <SelectItem key={avatar.avatar_id} value={avatar.avatar_id}>
                      {avatar.name}
                    </SelectItem>
                  ))}
                </Select>
                <Select
                  label="Select language"
                  placeholder="Select language"
                  className="max-w-xs"
                  selectedKeys={[language]}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                  }}
                >
                  {STT_LANGUAGE_LIST.map((lang) => (
                    <SelectItem key={lang.key}>{lang.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <Button
                className="bg-gradient-to-tr from-indigo-500 to-indigo-300 w-full text-white"
                size="md"
                variant="shadow"
                onClick={startSession}
              >
                Start session
              </Button>
            </div>
          ) : (
            <Spinner color="default" size="lg" />
          )}
        </CardBody>
        <Divider />
        <CardFooter className="flex flex-col gap-3 relative">
          {stream ? (
            <>
              <Tabs
                aria-label="Options"
                selectedKey={chatMode}
                onSelectionChange={(v) => {
                  handleChangeChatMode(v);
                }}
              >
                <Tab key="text_mode" title="Text mode" />
                <Tab key="voice_mode" title="Voice mode" />
              </Tabs>
              {chatMode === "text_mode" ? (
                <div className="w-full flex relative">
                  <InteractiveAvatarTextInput
                    disabled={!stream}
                    input={text}
                    label="Chat"
                    loading={isLoadingRepeat}
                    placeholder="Type something for the avatar to respond"
                    setInput={setText}
                    onSubmit={() => handleSpeak(text)}
                  />
                  {text && (
                    <Chip className="absolute right-16 top-3">Listening</Chip>
                  )}
                </div>
              ) : (
                <div className="w-full text-center">
                  <Button
                    isDisabled={!isUserTalking}
                    className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white"
                    size="md"
                    variant="shadow"
                  >
                    {isUserTalking ? "Listening" : "Voice chat"}
                  </Button>
                </div>
              )}
              {chatMode === "voice_mode" && (
                <div className="w-full text-center">
                  <Button
                    className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white"
                    size="md"
                    variant="shadow"
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    {isRecording ? "Stop Talking" : "Start Talking"}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500">
              Start a session to interact with the avatar
            </div>
          )}
        </CardFooter>
      </Card>
      <p className="font-mono text-right">
        <span className="font-bold">Console:</span>
        <br />
        {debug}
      </p>
    </div>
  );
}
