import { Message, OpenAIModel } from "@/types";
import { agents } from "@/utils/agents";

export const config = {
  runtime: "edge",
};

const handler = async (req: Request): Promise<Response> => {
  try {
    const { messages, agentType } = (await req.json()) as {
      messages: Message[];
      agentType?: string;
    };

    const prompt = agents[(agentType || "controller") as keyof typeof agents]?.prompt
      || "You are a helpful assistant.";

    const body = JSON.stringify({
      model: OpenAIModel.GPT_4_TURBO,
      messages: [{ role: "system", content: prompt }, ...messages],
      temperature: 0.5,
      stream: true,
    });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
      },
      body,
    });

return new Response(res.body, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  },
});
  } catch (err) {
    console.error("Server Error:", err);
    return new Response("Server Error", { status: 500 });
  }
};

export default handler;
