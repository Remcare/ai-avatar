import type { StartAvatarResponse } from "@heygen/streaming-avatar";

import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents, TaskMode, TaskType, VoiceEmotion,
} from "@heygen/streaming-avatar";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Divider,
  Input,
  Select,
  SelectItem,
  Spinner,
  Chip,
  Tabs,
  Tab,
} from "@nextui-org/react";
import { useEffect, useRef, useState, } from "react";
import { useMemoizedFn, usePrevious } from "ahooks";
import Sidebar from "./Sidebar";
import Session from "./Session";
import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";
import {AVATARS, STT_LANGUAGE_LIST} from "@/app/lib/constants";

export default function InteractiveAvatar() {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>();
  const [knowledgeId, setKnowledgeId] = useState<string>("");
  const [avatarId, setAvatarId] = useState<string>("");
  const [language, setLanguage] = useState<string>('en');
  const [data, setData] = useState<StartAvatarResponse>();
  const [text, setText] = useState<string>("");
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatar | null>(null);
  const [chatMode, setChatMode] = useState("text_mode");
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [overlayText, setOverlayText] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(
    null
  );
  const audioChunks = useRef<Blob[]>([]);
  const [currentUserSpeech, setCurrentUserSpeech] = useState<string>("");
  const [currentAvatarSpeech, setCurrentAvatarSpeech] = useState<string>("");
  const [transcribedTexts, setTranscribedTexts] = useState<Array<{text: string, timestamp: string, speaker: 'user' | 'avatar'}>>([]);
  const [currentAvatarMessage, setCurrentAvatarMessage] = useState<string>("");

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
    avatar.current?.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event: CustomEvent) => {
      const chunk = event.detail.message;
      setCurrentAvatarSpeech(prev => prev + chunk);
    });
    
    let avatarspeech = ""; // Declare outside to accumulate the message
    let userspeech="";
    // Event listener for AVATAR_TALKING_MESSAGE
    avatar.current?.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event: CustomEvent) => {
      const chunk = event.detail.message;
      console.log('Avatar talking message:', chunk);
      setCurrentAvatarSpeech(prev => prev + chunk);
      avatarspeech += chunk;
    });
    avatar.current?.on(StreamingEvents.AVATAR_END_MESSAGE, (event: CustomEvent) => {
      console.log('Avatar end message:', avatarspeech);
      const timestamp = new Date().toISOString();
      setTranscribedTexts(prev => [
        ...prev,
        { text: avatarspeech, timestamp, speaker: 'avatar' }
      ]);
      
      // Clear the current avatar speech after a delay
      setTimeout(() => {
        setCurrentAvatarSpeech("");
      }, 5000); // Clear after 5 seconds
    
      avatarspeech = "";
    });

    avatar.current.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
      console.log("Avatar stopped talking", e);
    });
    avatar.current.on(StreamingEvents.STREAM_DISCONNECTED, () => {
      console.log("Stream disconnected");
      endSession();
    });
    avatar.current?.on(StreamingEvents.STREAM_READY, async (event) => {
      console.log(">>>>> Stream ready:", event.detail);
      setStream(event.detail);
      await giveIntroductionSpeech();
    });
    avatar.current?.on(StreamingEvents.USER_START, (event) => {
      console.log(">>>>> User started talking:", event);
      setIsUserTalking(true);
    });
    avatar.current?.on(StreamingEvents.USER_TALKING_MESSAGE, (event: CustomEvent) => {
      const chunk = event.detail.message;
      console.log('User talking message:', chunk);
      setCurrentUserSpeech(prev => prev + chunk);
      userspeech += chunk;
    });
    
    avatar.current?.on(StreamingEvents.USER_END_MESSAGE, (event: CustomEvent) => {
      console.log('User end message:', userspeech);
      const timestamp = new Date().toISOString();
      setTranscribedTexts(prev => [
        { text: userspeech, timestamp, speaker: 'user' },
        ...prev
      ]);
      
      // Clear the current user speech after a delay
      setTimeout(() => {
        setCurrentUserSpeech("");
      }, 5000); // Clear after 5 seconds
    
      userspeech = "";
    });
    avatar.current?.on(StreamingEvents.USER_STOP, (event) => {
      console.log(">>>>> User stopped talking:", event);
      setIsUserTalking(false);
    });
    try {
      const res = await avatar.current.createStartAvatar({
        quality: AvatarQuality.Low,
        avatarName: avatarId,
        knowledgeId: "bb77e29751334e21b1ea609fb8223bc3", // Or use a custom `knowledgeBase`.
        voice: {
          rate: 1.5, // 0.5 ~ 1.5
          emotion: VoiceEmotion.EXCITED,
        },
        language: language,
      });

      setData(res);
      // default to voice mode
      await avatar.current?.startVoiceChat();
      setChatMode("voice_mode");
    } catch (error) {
      console.error("Error starting avatar session:", error);
    } finally {
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
    await avatar.current
      .interrupt()
      .catch((e) => {
        setDebug(e.message);
      });
  }
  async function endSession() {
    clearTranscribedTexts();
    setCurrentUserSpeech("");
    setCurrentAvatarMessage("");
    await avatar.current?.stopAvatar();
    setStream(undefined);
  }

  const handleChangeChatMode = useMemoizedFn(async (v) => {
    if (v === chatMode) {
      return;
    }
    if (v === "text_mode") {
      avatar.current?.closeVoiceChat();
    } else {
      await avatar.current?.startVoiceChat();
    }
    setChatMode(v);
  });
  const clearSpeechAfterDelay = (setter: React.Dispatch<React.SetStateAction<string>>, delay: number) => {
    setTimeout(() => {
      setter("");
    }, delay);
  };
  const generateFileContent = () => {
    return transcribedTexts.map(item => {
      const speaker = item.speaker ? item.speaker.toUpperCase() : 'UNKNOWN';
      return `[${item.timestamp}] ${speaker}: ${item.text}`;
    }).join('\n');
  };

  const handleDownload = () => {
    const content = generateFileContent();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcribed_texts.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const clearTranscribedTexts = () => {
    setTranscribedTexts([]);
  };

    //Handle the Intro Speech
    const giveIntroductionSpeech = async () => {
      if (!avatar.current) return;
      const introductionText = "Hello, I am your virtual assistiant. You can ask me any questions on Caesarean section and Anesthesia. I have been trained to answer questions from information given to me by University Hospital of Coventry & Warwickshire. You could ask me anything about Cesarian Section or what to expect on the day of the operation.";
      try {
        await avatar.current.speak({
          text: introductionText,
          task_type: TaskType.REPEAT,
        });
      } catch (error) {
        console.error("Error during introduction speech:", error);
      }
    };

  const speakText = async (text: string) => {
    if (!avatar.current) return;
    try {
      await avatar.current.speak({
        text: text,
        task_type: TaskType.REPEAT,
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };
  

  const previousText = usePrevious(text);
  //Text varibales for each section
const caesareanSectionInfo = "A Caesarean Section is a surgical procedure to deliver a baby through an incision in the abdomen and uterus, typically performed when a natural birth might pose risks to mother or child. Here, we'll explain why this procedure might be necessary, the benefits and risks involved, and circumstances under which you should contact our Labour Ward before your scheduled procedure. This section aims to provide you with a full understanding of what to expect.";
const beforeHospitalInfo = "Preparation is key to ensuring a smooth experience on the day of your Caesarean Section. In this section, we'll cover what to expect during your pre-operative assessment, the types of anesthesia available, and how to prepare the night before. Additionally, we'll go over a list of essential items to bring with you. Proper preparation will help ease any stress on the day of the procedure.";
const dayOfOperationInfo = "On the day of your operation, you'll check in at the hospital and complete some final preparations with our staff, who will guide you through each step leading up to surgery. This section outlines what to bring, guidelines for fasting, and when to arrive. You'll also learn about procedures like antiseptic washing and the importance of bringing only one birth partner to accompany you. These steps are in place to ensure your safety and comfort. Your Caesarean Section will be performed by a skilled team of healthcare professionals, including obstetricians, anesthetists, and midwives. This section provides an overview of who will be present, the process of spinal or general anesthesia, and how the surgery itself will be conducted. Our aim is for you and your birth partner to feel well-informed and supported throughout the procedure.";
const afterOperationInfo = "Following surgery, you'll be taken to a recovery area where you'll be closely monitored by our medical team. In this section, we'll discuss the post-operative care available, including pain relief options, strategies to prevent blood clots, and tips for maintaining comfort as you recover. We'll also introduce you to our enhanced recovery program to help you regain strength and mobility as soon as possible.";
const generalAdviceInfo = "We're committed to supporting your overall health and wellness. This section offers advice on topics like breastfeeding, smoking cessation, and nutritional needs during recovery. Our team is here to guide you with information on family planning and self-care routines to support you both in the hospital and after you return home. Let us know if you have any specific health needs while in our care.";
  useEffect(() => {
    if (!previousText && text) {
      avatar.current?.startListening();
    } else if (previousText && !text) {
      avatar?.current?.stopListening();
    }
  }, [text, previousText]);

  useEffect(() => {
    return () => {
      clearTranscribedTexts();
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

  return (
    <div className="flex w-full h-full p-4 gap-4">
      {/* Sidebar Card on the Left */}
      {stream && (
        <Card className="w-1/4 flex flex-col justify-center">
          <CardBody className="flex flex-col gap-4 justify-center items-center">
            <Sidebar
              speakText={speakText}
              caesareanSectionInfo={caesareanSectionInfo}
              beforeHospitalInfo={beforeHospitalInfo}
              dayOfOperationInfo={dayOfOperationInfo}
              afterOperationInfo={afterOperationInfo}
              generalAdviceInfo={generalAdviceInfo}
            />
          </CardBody>
        </Card>
      )}

      {/* Main Card */}
      <Card className="flex-1">
        <CardBody className="h-[300px] flex flex-col items-center">
          {/* Main Content Area */}
          {stream ? (
            <div className="relative h-[150px] w-[200px] flex justify-center items-center rounded-full overflow-hidden border-4 border-blue-500 shadow-lg">
              <video
                ref={mediaStream}
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
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

              </div>
            </div>
          ) : !isLoadingSession ? (
            <div className="h-full flex flex-col gap-8 justify-center items-center w-[500px] self-center">
              {/* Avatar and Language Selection */}
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
                    <SelectItem key={lang.key} value={lang.key}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <Button
                color="primary"
                size="md"
                onPress={startSession}
              >
                Start session
              </Button>
            </div>
          ) : (
            <Spinner color="default" size="lg" />
          )}
  <div className="mt-4 w-full">
    <div className="mb-2">
      <span className="font-bold">User Speech:</span>
      <p className="bg-gray-100 p-2 rounded">{currentUserSpeech || "Listening..."}</p>
    </div>
    <div>
      <span className="font-bold">Avatar Speech:</span>
      <p className="bg-blue-100 p-2 rounded">{currentAvatarSpeech || "Waiting for response..."}</p>
    </div>
  </div>
        </CardBody>

        <Divider />

        <CardFooter className="flex flex-col gap-3">
          {stream ? (
            <>
              <Tabs
                aria-label="Options"
                selectedKey={chatMode}
                onSelectionChange={(v) => handleChangeChatMode(v)}
              >
                <Tab key="text_mode" title="Text mode" />
                <Tab key="voice_mode" title="Voice mode" />
              </Tabs>
              {/* Chat Modes Implementation */}
            </>
          ) : (
            <div className="text-center text-gray-500">
              Start a session to interact with the avatar
            </div>
          )}
        </CardFooter>
      </Card>

        {/* Sidebar Card on the Left */}
        {stream && (
        <Card className="w-1/4 flex flex-col justify-center">
          <CardBody className="flex flex-col gap-4 justify-center items-center">
            <Session
            endSession={endSession}
            handleInterrupt={handleInterrupt}
            handleDownload={handleDownload}
            />
          </CardBody>
        </Card>
      )}
      
      <p className="font-mono text-right">
        <span className="font-bold">Console:</span>
        <br />
        {debug}
      </p>
    </div>
  );
}