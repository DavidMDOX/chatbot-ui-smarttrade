// types/index.ts

export enum OpenAIModel {
  GPT_4_TURBO = "gpt-4-1106-preview"  // 使用GPT-4 Turbo最新版本
}

export type Role = 
  | "assistant"
  | "user"
  | "controller"
  | "infoExtractor"
  | "fraudAuditor"
  | "priceQuoter"; // 加上你的虚拟助手角色

export interface Message {
  role: Role;
  content: string;
}

