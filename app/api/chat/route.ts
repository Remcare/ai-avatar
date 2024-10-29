import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: "org-rRHVNueZABsSwsFjccchyG5k",
  project: "proj_Nd6S7151hdpKMpelBrDOBM0L",
});
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

export async function POST(request: NextRequest) {
  try {
    const { message, threadId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "No message provided" },
        { status: 400 }
      );
    }

    if (!ASSISTANT_ID) {
      throw new Error("OPENAI_ASSISTANT_ID is missing from .env");
    }

    // Get existing thread or create a new one
    let thread;
    if (threadId) {
      try {
        thread = await openai.beta.threads.retrieve(threadId);
      } catch (error) {
        return NextResponse.json(
          { error: "Invalid thread ID provided" },
          { status: 400 }
        );
      }
    } else {
      thread = await openai.beta.threads.create();
    }

    // Add message to thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
    });

    // Wait for the completion
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

    while (runStatus.status !== "completed") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

      if (runStatus.status === "failed") {
        throw new Error("Assistant run failed");
      }
    }

    // Get the messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];

    // Type guard to ensure we're handling text content
    if (lastMessage.content[0].type === "text") {
      return NextResponse.json({
        response: lastMessage.content[0].text.value,
      });
    }

    return NextResponse.json(
      { error: "Unexpected response format" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Error in chat:", error);
    const assistants = await openai.beta.assistants.list();
    console.error(assistants);
    return NextResponse.json(
      { error: "Error processing chat request" },
      { status: 500 }
    );
  }
}
