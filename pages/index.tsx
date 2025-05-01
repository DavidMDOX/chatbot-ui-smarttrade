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

    // 1. controller 响应
    const controllerReply = await fetchAgentResponse([userMessage], "controller");

    // 2. 子助手响应（infoExtractor / fraudAuditor / priceQuoter）
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
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-center">SmartTrade 虚拟团队工作台</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {assistantRoles.map((role) => (
          <div key={role} className="border rounded-lg bg-white p-4 shadow h-[240px] overflow-y-auto">
            <div className="text-sm font-semibold text-blue-600 mb-2">
              🤖 {agents[role]?.name}
            </div>
            <div className="text-sm whitespace-pre-wrap text-gray-700">
              {chatByRole[role] || "（暂无消息）"}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 border px-3 py-2 rounded shadow"
          placeholder="请告诉流程总管你的任务需求..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendToController()}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded shadow"
          disabled={loading}
          onClick={handleSendToController}
        >
          {loading ? "处理中..." : "发送"}
        </button>
      </div>
    </div>
  );
}
