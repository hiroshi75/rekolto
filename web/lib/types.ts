export interface Item {
  id: string;
  type: string;
  title: string | null;
  url: string | null;
  content: string;
  summary: string | null;
  og_image: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  name: string;
  count: number;
}

export interface MemoryCategory {
  id: number;
  name: string;
  summary: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryItem {
  id: number;
  category_id: number;
  type: string;
  content: string;
  source_id: string | null;
  salience: number;
  access_count: number;
  last_accessed: string | null;
  created_at: string;
}

export interface Stats {
  totalItems: number;
  totalTags: number;
  totalMemoryItems: number;
  totalCategories: number;
  itemsByType: { type: string; count: number }[];
  recentItems: number;
}

export interface ChatSession {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: string;
  query: string;
  results: string | null; // JSON array of item IDs
  created_at: string;
}
