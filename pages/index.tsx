import { Chat } from "@/components/Chat/Chat";
import { Footer } from "@/components/Layout/Footer";
import { Navbar } from "@/components/Layout/Navbar";
import { Message } from "@/types";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]); // 聊天消息列表
  const [loading, setLoading] = useState<boolean>(false);   // 加载状态

  const messagesEndRef = useRef<HTMLDivElement>(null); // 用于自动滚动到底部

  // 滚动到底部函数
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 发送用户消息到后端，获得AI回复
  const handleSend = async (message: Message) => {
    const updatedMessages = [...messages, message];

    setMessages(updatedMessages);
    setLoading(true);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: updatedMessages
      })
    });

    if (!response.ok) {
      setLoading(false);
      throw new Error(response.statusText);
    }

    const data = response.body;

    if (!data) {
      return;
    }

    setLoading(false);

    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let isFirst = true;

    // 处理流式返回的数据
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);

      if (isFirst) {
        isFirst = false;
        setMessages((messages) => [
          ...messages,
          {
            role: "assistant",
            content: chunkValue
          }
        ]);
      } else {
        setMessages((messages) => {
          const lastMessage = messages[messages.length - 1];
          const updatedMessage = {
            ...lastMessage,
            content: lastMessage.content + chunkValue
          };
          return [...messages.slice(0, -1), updatedMessage];
        });
      }
    }
  };

  // 点击重置按钮时，恢复初始欢迎语
  const handleReset = () => {
    setMessages([
      {
        role: "assistant",
        content: `欢迎来到 SmartTrade！我是您的专属外贸AI助手，致力于为您高效对接全球供应链。无论是寻找优质供应商、撰写专业外贸邮件、报价谈判、还是制定出口策略，我都能为您提供精准、专业、风趣而高效的支持。
        
from Jiaming Li, CEO of SmartTrade.`
      }
    ]);
  };

  // 页面首次加载时，设置初始欢迎语
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `欢迎来到 SmartTrade！我是您的专属外贸AI助手，致力于为您高效对接全球供应链。无论是寻找优质供应商、撰写专业外贸邮件、报价谈判、还是制定出口策略，我都能为您提供精准、专业、风趣而高效的支持。
        
from Jiaming Li, CEO of SmartTrade.`
      }
    ]);
  }, []);

  // 每次消息变化时，自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <>
      <Head>
        <title>SmartTrade AI Assistant</title>
        <meta
          name="description"
          content="SmartTrade智能外贸平台，您的全球供应链AI助手"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <link
          rel="icon"
          href="/favicon.ico"
        />
      </Head>

      <div className="flex flex-col h-screen">
        <Navbar />

        <div className="flex-1 overflow-auto sm:px-10 pb-4 sm:pb-10">
          <div className="max-w-[800px] mx-auto mt-4 sm:mt-12">
            <Chat
              messages={messages}
              loading={loading}
              onSend={handleSend}
              onReset={handleReset}
            />
            <div ref={messagesEndRef} />
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
