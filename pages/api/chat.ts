import { Message } from "@/types";
import { agents } from "@/utils/agents";
import { OpenAIModel } from "@/types";

export const config = {
  runtime: "edge"
};

async function OpenAIStream(messages: Message[], agentType: keyof typeof agents) {
  const systemPrompt = agents[agentType]?.prompt || "You are a helpful assistant.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`
    },
    method: "POST",
    body: JSON.stringify({
      model: OpenAIModel.GPT_4_TURBO,  // ✅ 使用统一定义
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      temperature: 0.5,
      stream: true
    })
  });

  return res.body;
}

const handler = async (req: Request): Promise<Response> => {
  try {
    const { messages, agentType } = (await req.json()) as {
      messages: Message[];
      agentType?: string;
    };

    const charLimit = 12000;
    let charCount = 0;
    const messagesToSend: Message[] = [];

    for (const message of messages) {
      if (charCount + message.content.length > charLimit) break;
      charCount += message.content.length;
      messagesToSend.push(message);
    }

    const stream = await OpenAIStream(messagesToSend, (agentType || "controller") as keyof typeof agents);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream"
      }
    });
  } catch (error) {
    console.error("API handler error:", error);
    return new Response("Error", { status: 500 });
  }
};

export default handler;
