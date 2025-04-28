import { Message, OpenAIModel } from "@/types";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export const OpenAIStream = async (messages: Message[]) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}` // 从环境变量读取OpenAI密钥
    },
    method: "POST",
    body: JSON.stringify({
      model: OpenAIModel.DAVINCI_TURBO, // 使用davinci turbo模型（可以根据需要换成gpt-4）
      messages: [
        {
          role: "system",
          content: `You are an AI assistant specializing in international B2B trade.
You are polite, witty, highly professional, and very efficient.
You help users find suppliers, write professional emails, negotiate deals, and optimize export strategies.
Always maintain a friendly, confident, and concise tone.` 
          // 设置AI角色为：外贸B2B专家，礼貌风趣专业高效
        },
        ...messages // 把用户的历史对话接在后面
      ],
      max_tokens: 800, // 设定最大回复长度
      temperature: 0.0, // 温度设0，保证回答准确严谨
      stream: true // 使用流式输出，提升响应速度体验
    })
  });

  // 如果OpenAI接口请求失败
  if (res.status !== 200) {
    throw new Error("OpenAI API returned an error");
  }

  // 把OpenAI的stream结果封装成浏览器可读的流
  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;

          if (data === "[DONE]") {
            controller.close(); // 数据结束，关闭流
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue); // 把收到的数据推送给前端
          } catch (e) {
            controller.error(e); // 出错处理
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
