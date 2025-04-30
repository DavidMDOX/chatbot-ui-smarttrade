import { agents } from "./agents";
import { Message } from "@/types";

type AgentKey = keyof typeof agents;

export const fetchAgentResponse = async (
  messages: Message[],
  agentType: AgentKey
) => {
  const systemPrompt = agents[agentType]?.prompt || "You are a helpful assistant.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`
    },
    method: "POST",
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      temperature: 0.5,
      stream: true
    })
  });

  return res;
};
