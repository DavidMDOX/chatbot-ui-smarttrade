// utils/OpenAIStream.ts

import { Message, OpenAIModel } from "@/types";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export const OpenAIStream = async (messages: Message[], agentType: string) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}` // 你的密钥
    },
    method: "POST",
    body: JSON.stringify({
      model: OpenAIModel.GPT_4_TURBO, // ✅ 这里用 gpt-4-turbo
      messages: [
        {
          role: "system",
          content: getAgentSystemPrompt(agentType) // 根据助手类型，设置不同提示词
        },
        ...messages
      ],
      temperature: 0.2,
      stream: true,
      max_tokens: 1200
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
            const text = json.choices[0]?.delta?.content || "";
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

// 根据不同角色，设置不同系统提示词
const getAgentSystemPrompt = (agentType: string) => {
  switch (agentType) {
    case "controller":
      return "你是SmartTrade的流程主管，请根据用户需求合理分配下游助手工作。";
    case "infoExtractor":
      return "你是SmartTrade的信息提取专员，请从用户邮件中提取关键信息，并总结成简洁列表。";
    case "fraudAuditor":
      return "你是SmartTrade的客户审核专员，请判断客户是否可信并解释原因。";
    case "priceQuoter":
      return "你是SmartTrade的报价专员，请根据用户需求，给出专业简洁的报价回复。";
    default:
      return "你是SmartTrade智能助手，礼貌、专业、高效地帮助用户。";
  }
};
