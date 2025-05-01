// /pages/api/chat.ts
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
      stream: false, // ❌ 暂时关闭流式
    });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
      },
      body,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("OpenAI Error:", errorText);
      return new Response("OpenAI API Error", { status: 500 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "（助手没有返回任何内容）";

    return new Response(content, {
      headers: {
        "Content-Type": "text/plain",
      },
    });
  } catch (err) {
    console.error("Server Error:", err);
    return new Response("Server Error", { status: 500 });
  }
};

export default handler;
