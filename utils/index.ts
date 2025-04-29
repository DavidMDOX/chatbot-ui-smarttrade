import { Message } from "@/types";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import { agents } from "@/utils/agents"; // 引入各个虚拟助手角色定义

// OpenAIStream支持根据不同角色动态发送请求
export const OpenAIStream = async (messages: Message[], agentType = "controller") => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // 根据agentType，加载对应角色的system prompt
  const systemPrompt = agents[agentType]?.prompt || "You are a helpful assistant.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    method: "POST",
    body: JSON.stringify({
      model: "gpt-4-turbo", // 使用更聪明的模型
      messages: [
        {
          role: "system",
          content: systemPrompt // 使用对应助手的个性化指导
        },
        ...messages // 把用户历史对话放后面
      ],
      max_tokens: 800,
      temperature: 0.0,
      stream: true
    })
  });

  if (res.status !== 200) {
    throw new Error("OpenAI API returned an error");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    }
  });

  return stream;
};
