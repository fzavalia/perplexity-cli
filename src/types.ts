export type MessageSource = {
  title: string;
  url: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources: MessageSource[];
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};
