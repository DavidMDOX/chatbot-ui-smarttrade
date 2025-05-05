import { useState } from "react";
import { agents } from "@/utils/agents";
import { Message } from "@/types";

type AgentRole = keyof typeof agents;
type RoleName = AgentRole | "user";

interface AgentMessage {
  role: RoleName;
  content: string;
}

const subAgents: AgentRole[] = [
  "infoExtractor",
  "fraudAuditor",
  "priceQuoter",
  "logisticsCoordinator",
  "afterSalesSupport",
];

const toMessageArray = (log: AgentMessage[]): Message[] =>
  log.map((msg) => ({
    role: msg.role === "user" ? "user" : "assistant",
    content: msg.content,
  }));

export default function MultiAgentChat() {
  const [chatLog, setChatLog] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendToController = async () => {
    if (!input.trim()) return;

    const userMessage: AgentMessage = { role: "user", content: input };
    const updatedLog = [...chatLog, userMessage];
    setChatLog(updatedLog);
    setLoading(true);
    setInput("");

    const controllerResponse = await fetchAgentResponse(
      toMessageArray(updatedLog),
      "controller"
    );
    const logWithController: AgentMessage[] = [
      ...updatedLog,
      { role: "controller", content: controllerResponse },
    ];

    const assistantResponses = await Promise.all(
      subAgents.map((role) =>
        fetchAgentResponse([{ role: "user", content: input }], role)
      )
    );

    const assistantMessages: AgentMessage[] = subAgents.map((role, idx) => ({
      role,
      content: assistantResponses[idx],
    }));

    setChatLog([...logWithController, ...assistantMessages]);
    setLoading(false);
  };

  const fetchAgentResponse = async (
    messages: Message[],
    agentType: AgentRole
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
                json.choices?.[0]?.delta?.content ??
                json.choices?.[0]?.message?.content;
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

  const groupedMessages: Record<RoleName, string[]> = {
    user: [],
    controller: [],
    infoExtractor: [],
    fraudAuditor: [],
    priceQuoter: [],
    logisticsCoordinator: [],
    afterSalesSupport: [],
  };

  chatLog.forEach((msg) => {
    groupedMessages[msg.role].push(msg.content);
  });

  const renderRoleBox = (role: RoleName) => (
    <div
      key={role}
      className="rounded-lg border border-blue-200 bg-white shadow p-4 mb-4"
    >
      <h2 className="font-semibold text-blue-700 mb-2">
        {role === "user"
          ? "🧑 用户"
          : `🤖 ${agents[role as AgentRole]?.name || role}`}
      </h2>
      {groupedMessages[role]?.map((text, idx) => (
        <div key={idx} className="text-sm text-gray-800 whitespace-pre-wrap mb-2">
          {text}
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 min-h-screen bg-gradient-to-br from-white to-blue-50">
      <h1 className="text-3xl font-bold text-center text-blue-800 mb-6">
        💼 SmartTrade 虚拟团队工作台
      </h1>

      {/* 用户输入 */}
      {renderRoleBox("user")}

      {/* 一级主模块：流程总管 */}
      <div className="mb-6">{renderRoleBox("controller")}</div>

      {/* 二级模块：流程总管下属助手 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {subAgents.map((role) => renderRoleBox(role))}
      </div>

      {loading && (
        <div className="text-sm text-gray-500 mb-4 text-center">🤖 助手处理中……</div>
      )}

      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <input
          className="flex-1 border border-blue-300 px-4 py-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="请输入任务，例如：请帮我回复客户的这封英文邮件……"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendToController()}
        />
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow transition-colors"
          disabled={loading}
          onClick={handleSendToController}
        >
          {loading ? "处理中..." : "发给流程总管"}
        </button>
      </div>
    </div>
  );
}
