import { Message } from "@/types";
import { agents } from "@/utils/agents";

export const config = {
  runtime: "edge"
};

// ✅ 内部定义 OpenAIStream 函数（替代缺失导出）
async function OpenAIStream(messages: Message[], agentType: keyof typeof agents) {
  const systemPrompt = agents[agentType]?.prompt || "You are a helpful assistant.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`
    },
    method: "POST",
    body: JSON.stringify({
      model: "gpt-4-turbo",
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
    let messagesToSend: Message[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (charCount + message.content.length > charLimit) {
        break;
      }
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
    console.error(error);
    return new Response("Error", { status: 500 });
  }
};

export default handler;
