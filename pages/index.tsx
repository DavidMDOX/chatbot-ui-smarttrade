import { useState } from "react";
import { agents } from "@/utils/agents";
import { Message } from "@/types";

type RoleName = keyof typeof agents | "user";

interface AgentMessage {
  role: RoleName;
  content: string;
}

const assistantRoles: RoleName[] = ["controller", "infoExtractor", "fraudAuditor", "priceQuoter"];

const toMessageArray = (log: AgentMessage[]): Message[] =>
  log.map((msg) => ({
    role: msg.role === "user" ? "user" : "assistant",
    content: msg.content,
  }));

export default function MultiAgentChat() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatByRole, setChatByRole] = useState<Record<RoleName, string>>({
    controller: "",
    infoExtractor: "",
    fraudAuditor: "",
    priceQuoter: "",
  });

  const handleSendToController = async () => {
    if (!input.trim()) return;

    setLoading(true);
    const userMessage: Message = { role: "user", content: input };

    const controllerReply = await fetchAgentResponse([userMessage], "controller");
    const [info, audit, quote] = await Promise.all([
      fetchAgentResponse([userMessage], "infoExtractor"),
      fetchAgentResponse([userMessage], "fraudAuditor"),
      fetchAgentResponse([userMessage], "priceQuoter"),
    ]);

    setChatByRole({
      controller: controllerReply,
      infoExtractor: info,
      fraudAuditor: audit,
      priceQuoter: quote,
    });

    setInput("");
    setLoading(false);
  };

  const fetchAgentResponse = async (
    messages: Message[],
    agentType: string
  ): Promise<string> => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, agentType }),
      });

      if (!res.ok || !res.body) return "（助手未能回应，请稍后再试）";

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let result = "";
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk
            .split("\n")
            .filter((line) => line.trim().startsWith("data:"));
          for (const line of lines) {
            const jsonStr = line.replace("data: ", "").trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const json = JSON.parse(jsonStr);
              const delta =
                json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content;
              if (delta) result += delta;
            } catch (err) {
              console.error("JSON parse error:", err);
            }
          }
        }
      }

      return result || "（助手没有返回任何内容）";
    } catch (err) {
      console.error("fetchAgentResponse error:", err);
      return "（请求出错，请稍后重试）";
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-8 text-blue-700">SmartTrade 虚拟团队工作台</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {assistantRoles.map((role) => (
          <div
            key={role}
            className="rounded-lg shadow-lg bg-gradient-to-br from-white to-blue-50 border border-blue-200 p-5 hover:shadow-xl transition-shadow"
          >
            <h2 className="font-semibold text-blue-800 text-lg mb-3">
              🤖 {agents[role]?.name}
            </h2>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
              {chatByRole[role] || "（暂无消息）"}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <input
          className="flex-1 border border-gray-300 px-4 py-2 rounded-full shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="请告诉流程总管你的任务需求..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendToController()}
        />
        <button
          className="bg-blue-600 hover:bg-blue-700 transition text-white font-medium px-5 py-2 rounded-full shadow"
          disabled={loading}
          onClick={handleSendToController}
        >
          {loading ? "处理中..." : "发送"}
        </button>
      </div>
    </div>
  );
}
