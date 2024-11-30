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
import { SetStateAction, useEffect, useRef, useState, } from "react";
import { useMemoizedFn, usePrevious } from "ahooks";
import Sidebar from "./Sidebar";
import Session from "./Session";
import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";
import {AVATARS, VOICES,STT_LANGUAGE_LIST,STT_KNOWLEDGE_LIST} from "@/app/lib/constants";
import { addTranscribedText, clearTranscribedTexts, handleDownload } from './transcriptManager';

export default function InteractiveAvatar() {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>();
  const [avatarId, setAvatarId] = useState<string>("");
  const [language, setLanguage] = useState<string>('en');
  const [data, setData] = useState<StartAvatarResponse>();
  const [text, setText] = useState<string>("");
  const [knowledgeId, setKnowledgeId] = useState<string>("");
  const [voiceId, setVoiceId] = useState<string>("");
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatar | null>(null);
  const [chatMode, setChatMode] = useState("text_mode");
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [currentUserSpeech, setCurrentUserSpeech] = useState<string>("");
  const [currentAvatarSpeech, setCurrentAvatarSpeech] = useState<string>("");
  const [transcribedTexts, addTranscribedTexts] = useState<Array<{text: string, timestamp: string, speaker: 'user' | 'avatar'}>>([]);
  const [currentAvatarMessage, setCurrentAvatarMessage] = useState<string>("");
  const [isListening, setIsListening] = useState(false);
  
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
      avatarspeech += chunk;
    });
    avatar.current?.on(StreamingEvents.AVATAR_END_MESSAGE, (event: CustomEvent) => {
      console.log('Avatar end message:', avatarspeech);
      addTranscribedText(avatarspeech, 'avatar');
      setCurrentAvatarSpeech(prev => prev + avatarspeech + "\n");
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
      setIsListening(true);
    });
    avatar.current?.on(StreamingEvents.USER_TALKING_MESSAGE, (event: CustomEvent) => {
      const chunk = event.detail.message;
      console.log('User talking message:', chunk);
      setCurrentUserSpeech(prev => prev + chunk);
      userspeech += chunk;
    });
    
    avatar.current?.on(StreamingEvents.USER_END_MESSAGE, (event: CustomEvent) => {
      console.log('User end message:', userspeech);
      addTranscribedText(userspeech, 'user');
      setCurrentUserSpeech(prev => prev + userspeech + "\n");
      userspeech = "";
    });
    avatar.current?.on(StreamingEvents.USER_STOP, (event) => {
      console.log(">>>>> User stopped talking:", event);
      setIsUserTalking(false);
      setIsListening(false);
    });
    try {
      const res = await avatar.current.createStartAvatar({
        quality: AvatarQuality.Low,
        avatarName: avatarId,
        knowledgeId: knowledgeId, 
        /*voice: {
          rate: 1.5, // 0.5 ~ 1.5
          emotion: VoiceEmotion.EXCITED,
        },*/
        voice: {
          voiceId:voiceId,
          //80f371302eaa4404870daa41dc62423c',//french female
          //french male: 90fc4e27e9e349f196767c0ada520abd
          //ssvoiceId:'0009aabefe3a4553bc581d837b6268cb',
          //voiceId: '2d5b0e6cf36f460aa7fc47e3eee4ba54',//Sofia
          //voiceId:'0009aabefe3a4553bc581d837b6268cb', // Walter
          //uk female:2d5b0e6cf36f460aa7fc47e3eee4ba54, 628161fd1c79432d853b610e84dbc7a4
          //uk male: f5a3cb4edbfc4d37b5614ce118be7bc8
          rate: 1.0, // Adjust the speaking rate as needed (0.5 to 1.5)// Choose an appropriate emotion
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

  const handleVoiceChange = (voiceId: SetStateAction<string>) => {
    setVoiceId(voiceId);

    // Find the selected voice
    const selectedVoice = VOICES.find((voice) => voice.voice_id === voiceId);
    if (selectedVoice) {
      // Set the language
      setLanguage(selectedVoice.language);

      // Set the avatar based on gender
      const matchingAvatar = AVATARS.find(
        (avatar) => avatar.gender === selectedVoice.gender
      );
      if (matchingAvatar) {
        setAvatarId(matchingAvatar.avatar_id);
      }
    }
  };

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
    clearTranscribedTexts(); // Clear all transcribed texts
    setCurrentUserSpeech(""); // Clear user speech
    setCurrentAvatarSpeech(""); // Clear avatar speech
    await avatar.current?.stopAvatar(); // Stop the avatar
    setStream(undefined); // Reset the media stream
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
    //Handle the Intro Speech
    const giveIntroductionSpeech = async () => {
      if (!avatar.current) return;
      const introductionText = "Hello, I am your virtual assistant. You can ask me any questions on Caesarean section and Anesthesia. I have been trained to answer questions from information given to me by University Hospital of Coventry & Warwickshire. You could ask me anything about Cesarian Section or what to expect on the day of the operation.";
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
      setCurrentAvatarSpeech("");
      setCurrentAvatarSpeech("");
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
    <div className="relative w-full h-full p-4 flex justify-center items-center gap-4" style={{ backgroundColor: '#C6EEF1' }}>
      {/* Main Card */}
      <div className="w-[500px] h-[500px] flex gap-4 justify-center items-start">
      <Card className="w-[600px] h-[500px]" style={{ backgroundColor: '#C6EEF1' }}>
        <CardBody className="flex flex-col items-center h-full p-0">
          {/* Avatar Video */}
          {stream ? (
                   <div className="relative flex justify-center items-center h-[70%] w-full rounded-t-lg overflow-hidden border-b-2 border-blue-500">
                   <video
                     ref={mediaStream}
                     autoPlay
                     playsInline
                     style={{
                       width: '100%',
                       height: '100%',
                       objectFit: 'cover',
                       objectPosition: 'center',
                     }}
                   >
                     <track kind="captions" />
                   </video>
                 </div>
          ) : !isLoadingSession ? (
            <div className="flex flex-col gap-4 justify-center items-center w-full h-full">
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Select label="Select Hospital" placeholder="Select Hospital" onChange={(e) => setKnowledgeId(e.target.value)}>
                  {STT_KNOWLEDGE_LIST.map((hospital) => (
                    <SelectItem key={hospital.key} value={hospital.key}>
                      {hospital.label}
                    </SelectItem>
                  ))}
                </Select>
                <Select
        label="Select Voice"
        placeholder="Select one"
        selectedKeys={[voiceId]}
        onChange={(e) => handleVoiceChange(e.target.value)}
      >
        {VOICES.map((voice) => (
          <SelectItem key={voice.voice_id} value={voice.voice_id}>
            {voice.name}
          </SelectItem>
        ))}
      </Select>

      <Select
        label="Select Custom Avatar"
        placeholder="Select one from these example avatars"
        selectedKeys={[avatarId]}
        onChange={(e) => setAvatarId(e.target.value)}
      >
        {AVATARS.map((avatar) => (
          <SelectItem key={avatar.avatar_id} value={avatar.avatar_id}>
            {avatar.name}
          </SelectItem>
        ))}
      </Select>

      {/*<Select
        label="Select Language"
        placeholder="Select one"
        selectedKeys={[language]}
        onChange={(e) => setLanguage(e.target.value)}
      >
        {STT_LANGUAGE_LIST.map((lang) => (
          <SelectItem key={lang.key} value={lang.value}>
            {lang.label}
          </SelectItem>
        ))}
      </Select>*/}
              </div>
              <Button color="primary" size="md" onPress={startSession} style={{ backgroundColor: '#41C5D1', color: 'white' }}>
                Start session
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <Spinner color="default" size="lg" />
            </div>
          )}
  
          {/* Buttons Section */}
          {stream && (
      <div className="flex justify-center items-center gap-4 w-full h-[10%] bg-blue-200 border-b-2 border-blue-300" style={{ backgroundColor: '#80D5DE'}}>
        <Button onPress={handleInterrupt}  style={{ backgroundColor: '#2CA9B5', color: 'white' }}>
          Interrupt Avatar
        </Button>
        <Button onPress={endSession}  style={{ backgroundColor: '#2CA9B5', color: 'white' }}>
          End Session
        </Button>
        <Button onPress={handleDownload} style={{ backgroundColor: '#2CA9B5', color: 'white' }}>
          Download Transcript
        </Button>
      </div>
    )}
  
          {/* Speech Card */}
          {stream && (
            <div className="w-full h-[20%] bg-white p-4 rounded-md shadow-inner border-2 border-gray-200 overflow-y-auto text-sm">
{[{ title: 'User Speech', speech: currentUserSpeech, bgColor: 'bg-gray-100', textColor: 'text-primary' },
      { title: 'Avatar Speech', speech: currentAvatarSpeech, bgColor: 'bg-blue-100', textColor: 'text-blue-600' }
    ].map(({ title, speech, bgColor, textColor }, idx) => (
      <div key={idx} className="mb-2">
        <span className={`font-bold ${textColor} text-sm`}>{title}:</span>
        <div className={`${bgColor} p-2 rounded text-black min-h-[50px] max-h-[100px] overflow-y-auto text-sm flex flex-col-reverse`}>
          {speech ? (
            speech.split("\n").map((msg, index, array) => (
              <div key={array.length - 1 - index}>
                <span className="text-xs text-gray-500">{title.split(' ')[0]}. </span>
                <span>{msg}</span>
              </div>
            ))
          ) : (
            <div>Waiting for {title.toLowerCase()}...</div>
          )}
        </div>
      </div>
    ))}
    </div>
)}

        </CardBody>
      </Card>
      </div>
      {/* Left Sidebar */}
{/* Left Sidebar */}

{stream && (
  <><div className="w-[500px] h-[500px] flex gap-4 justify-center items-start"><Card className="w-[600px] h-[500px]" style={{ backgroundColor: '#80D5DE', padding: '20px' }}>
          <CardBody className="flex flex-col gap-4">
            <div className="text-left mb-4">
              <h3 className="text-lg font-bold text-black">What would you like to ask?</h3>
            </div>
            <div className="flex flex-col items-start gap-2">
              <button className="w-[150px] h-[40px] bg-[#00A4B8] text-white rounded-full hover:bg-[#007A8A]">
                About C-Section
              </button>
              <button className="w-[150px] h-[40px] bg-[#00A4B8] text-white rounded-full hover:bg-[#007A8A]">
                Before You Come
              </button>
              <button className="w-[150px] h-[40px] bg-[#00A4B8] text-white rounded-full hover:bg-[#007A8A]">
                Day of Operation
              </button>
              <button className="w-[150px] h-[40px] bg-[#00A4B8] text-white rounded-full hover:bg-[#007A8A]">
                After Operation
              </button>
              <button className="w-[150px] h-[40px] bg-[#00A4B8] text-white rounded-full hover:bg-[#007A8A]">
                General Advice
              </button>
            </div>
          </CardBody>

          <CardFooter>
            {/* Listening Status Chip */}
            {stream && (
              <Chip
                color={isListening ? "success" : "default"}
                variant="solid"
                className="absolute bottom-2 right-2"
              >
                {isListening ? "Listening" : "Not Listening"}
              </Chip>
            )}
          </CardFooter>
        </Card>
        </div></>
)}
    </div>
  );
  }