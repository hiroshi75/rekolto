export const LOCALES = ["en", "ja", "zh-CN", "zh-TW", "es", "pt-BR", "ko"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ja: "日本語",
  "zh-CN": "中文（简体）",
  "zh-TW": "中文（繁體）",
  es: "Español",
  "pt-BR": "Português (Brasil)",
  ko: "한국어",
};

export const DEFAULT_LOCALE: Locale = "en";

export interface Dict {
  // Sidebar & Nav
  nav_search: string;
  nav_tags: string;
  nav_insight: string;
  nav_stats: string;
  nav_settings: string;
  subtitle: string;

  // Search
  search_heading: string;
  search_placeholder: string;
  search_button: string;
  searching: string;
  recent_items: string;
  n_results: string; // use {n} placeholder
  no_items_found: string;

  // Item detail
  untitled: string;
  summary: string;
  content: string;
  delete_button: string;
  delete_confirm: string;

  // Tags
  tags_heading: string;
  no_tags: string;
  n_items: string; // use {n} placeholder
  no_items_with_tag: string;

  // Insight
  insight_heading: string;
  weekly_digest: string;
  cached: string;
  items_this_week: string;
  searches_this_week: string;
  rediscover: string;
  key_knowledge: string;
  no_memory_items: string;
  categories: string;
  no_categories: string;
  recent_searches: string;

  // Stats
  stats_heading: string;
  total_items: string;
  total_tags: string;
  memory_items: string;
  items_this_week_stat: string;
  last_7_days: string;
  items_by_type: string;
  type: string;
  count: string;
  no_items: string;

  // Settings
  settings_heading: string;
  language: string;
  saved: string;

  // Chat
  new_chat: string;
  chat_placeholder: string;
  chat_send: string;
  chat_empty: string;
  chat_searching: string;
  chat_no_results: string;
  chat_delete_session: string;
  chat_delete_confirm: string;
}

const en: Dict = {
  nav_search: "Search",
  nav_tags: "Tags",
  nav_insight: "Insight",
  nav_stats: "Stats",
  nav_settings: "Settings",
  subtitle: "Personal knowledge base",

  search_heading: "Search",
  search_placeholder: "Search your knowledge...",
  search_button: "Search",
  searching: "Searching...",
  recent_items: "Recent items",
  n_results: "{n} results",
  no_items_found: "No items found. Try a different search term.",

  untitled: "Untitled",
  summary: "Summary",
  content: "Content",
  delete_button: "Delete",
  delete_confirm: "Are you sure?",

  tags_heading: "Tags",
  no_tags: "No tags yet.",
  n_items: "{n} items",
  no_items_with_tag: "No items found with this tag.",

  insight_heading: "Insight",
  weekly_digest: "Weekly Digest",
  cached: "cached",
  items_this_week: "Items This Week",
  searches_this_week: "Searches This Week",
  rediscover: "Rediscover",
  key_knowledge: "Key Knowledge",
  no_memory_items: "No memory items yet.",
  categories: "Categories",
  no_categories: "No categories yet.",
  recent_searches: "Recent Searches",

  stats_heading: "Statistics",
  total_items: "Total Items",
  total_tags: "Total Tags",
  memory_items: "Memory Items",
  items_this_week_stat: "Items This Week",
  last_7_days: "Last 7 days",
  items_by_type: "Items by Type",
  type: "Type",
  count: "Count",
  no_items: "No items yet.",

  settings_heading: "Settings",
  language: "Language",
  saved: "Saved!",

  new_chat: "New Chat",
  chat_placeholder: "Ask your knowledge base...",
  chat_send: "Send",
  chat_empty: "Start a conversation by typing a question below.",
  chat_searching: "Searching...",
  chat_no_results: "No results found.",
  chat_delete_session: "Delete",
  chat_delete_confirm: "Delete this chat?",
};

const ja: Dict = {
  nav_search: "検索",
  nav_tags: "タグ",
  nav_insight: "インサイト",
  nav_stats: "統計",
  nav_settings: "設定",
  subtitle: "パーソナルナレッジベース",

  search_heading: "検索",
  search_placeholder: "ナレッジを検索...",
  search_button: "検索",
  searching: "検索中...",
  recent_items: "最近のアイテム",
  n_results: "{n}件の結果",
  no_items_found: "アイテムが見つかりません。別の検索語をお試しください。",

  untitled: "無題",
  summary: "要約",
  content: "コンテンツ",
  delete_button: "削除",
  delete_confirm: "本当に削除しますか？",

  tags_heading: "タグ",
  no_tags: "タグはまだありません。",
  n_items: "{n}件",
  no_items_with_tag: "このタグのアイテムはありません。",

  insight_heading: "インサイト",
  weekly_digest: "週間ダイジェスト",
  cached: "キャッシュ",
  items_this_week: "今週のアイテム",
  searches_this_week: "今週の検索",
  rediscover: "再発見",
  key_knowledge: "重要なナレッジ",
  no_memory_items: "メモリアイテムはまだありません。",
  categories: "カテゴリ",
  no_categories: "カテゴリはまだありません。",
  recent_searches: "最近の検索",

  stats_heading: "統計",
  total_items: "アイテム合計",
  total_tags: "タグ合計",
  memory_items: "メモリアイテム",
  items_this_week_stat: "今週のアイテム",
  last_7_days: "過去7日間",
  items_by_type: "タイプ別アイテム",
  type: "タイプ",
  count: "件数",
  no_items: "アイテムはまだありません。",

  settings_heading: "設定",
  language: "言語",
  saved: "保存しました！",

  new_chat: "新しいチャット",
  chat_placeholder: "ナレッジベースに質問...",
  chat_send: "送信",
  chat_empty: "下に質問を入力して会話を始めましょう。",
  chat_searching: "検索中...",
  chat_no_results: "結果が見つかりません。",
  chat_delete_session: "削除",
  chat_delete_confirm: "このチャットを削除しますか？",
};

const zhCN: Dict = {
  nav_search: "搜索",
  nav_tags: "标签",
  nav_insight: "洞察",
  nav_stats: "统计",
  nav_settings: "设置",
  subtitle: "个人知识库",

  search_heading: "搜索",
  search_placeholder: "搜索知识...",
  search_button: "搜索",
  searching: "搜索中...",
  recent_items: "最近的项目",
  n_results: "{n}条结果",
  no_items_found: "未找到项目。请尝试其他搜索词。",

  untitled: "无标题",
  summary: "摘要",
  content: "内容",
  delete_button: "删除",
  delete_confirm: "确定要删除吗？",

  tags_heading: "标签",
  no_tags: "暂无标签。",
  n_items: "{n}个项目",
  no_items_with_tag: "该标签下没有项目。",

  insight_heading: "洞察",
  weekly_digest: "每周摘要",
  cached: "缓存",
  items_this_week: "本周项目",
  searches_this_week: "本周搜索",
  rediscover: "重新发现",
  key_knowledge: "核心知识",
  no_memory_items: "暂无记忆项目。",
  categories: "分类",
  no_categories: "暂无分类。",
  recent_searches: "最近搜索",

  stats_heading: "统计",
  total_items: "项目总数",
  total_tags: "标签总数",
  memory_items: "记忆项目",
  items_this_week_stat: "本周项目",
  last_7_days: "过去7天",
  items_by_type: "按类型分布",
  type: "类型",
  count: "数量",
  no_items: "暂无项目。",

  settings_heading: "设置",
  language: "语言",
  saved: "已保存！",

  new_chat: "新对话",
  chat_placeholder: "向知识库提问...",
  chat_send: "发送",
  chat_empty: "在下方输入问题开始对话。",
  chat_searching: "搜索中...",
  chat_no_results: "未找到结果。",
  chat_delete_session: "删除",
  chat_delete_confirm: "删除此对话？",
};

const zhTW: Dict = {
  nav_search: "搜尋",
  nav_tags: "標籤",
  nav_insight: "洞察",
  nav_stats: "統計",
  nav_settings: "設定",
  subtitle: "個人知識庫",

  search_heading: "搜尋",
  search_placeholder: "搜尋知識...",
  search_button: "搜尋",
  searching: "搜尋中...",
  recent_items: "最近的項目",
  n_results: "{n}筆結果",
  no_items_found: "找不到項目。請嘗試其他搜尋詞。",

  untitled: "無標題",
  summary: "摘要",
  content: "內容",
  delete_button: "刪除",
  delete_confirm: "確定要刪除嗎？",

  tags_heading: "標籤",
  no_tags: "目前沒有標籤。",
  n_items: "{n}個項目",
  no_items_with_tag: "此標籤下沒有項目。",

  insight_heading: "洞察",
  weekly_digest: "每週摘要",
  cached: "快取",
  items_this_week: "本週項目",
  searches_this_week: "本週搜尋",
  rediscover: "重新發現",
  key_knowledge: "核心知識",
  no_memory_items: "目前沒有記憶項目。",
  categories: "分類",
  no_categories: "目前沒有分類。",
  recent_searches: "最近搜尋",

  stats_heading: "統計",
  total_items: "項目總數",
  total_tags: "標籤總數",
  memory_items: "記憶項目",
  items_this_week_stat: "本週項目",
  last_7_days: "過去7天",
  items_by_type: "依類型分佈",
  type: "類型",
  count: "數量",
  no_items: "目前沒有項目。",

  settings_heading: "設定",
  language: "語言",
  saved: "已儲存！",

  new_chat: "新對話",
  chat_placeholder: "向知識庫提問...",
  chat_send: "傳送",
  chat_empty: "在下方輸入問題開始對話。",
  chat_searching: "搜尋中...",
  chat_no_results: "未找到結果。",
  chat_delete_session: "刪除",
  chat_delete_confirm: "刪除此對話？",
};

const es: Dict = {
  nav_search: "Buscar",
  nav_tags: "Etiquetas",
  nav_insight: "Insight",
  nav_stats: "Estadísticas",
  nav_settings: "Ajustes",
  subtitle: "Base de conocimiento personal",

  search_heading: "Buscar",
  search_placeholder: "Buscar conocimiento...",
  search_button: "Buscar",
  searching: "Buscando...",
  recent_items: "Elementos recientes",
  n_results: "{n} resultados",
  no_items_found: "No se encontraron elementos. Prueba otro término de búsqueda.",

  untitled: "Sin título",
  summary: "Resumen",
  content: "Contenido",
  delete_button: "Eliminar",
  delete_confirm: "¿Estás seguro?",

  tags_heading: "Etiquetas",
  no_tags: "Aún no hay etiquetas.",
  n_items: "{n} elementos",
  no_items_with_tag: "No se encontraron elementos con esta etiqueta.",

  insight_heading: "Insight",
  weekly_digest: "Resumen Semanal",
  cached: "caché",
  items_this_week: "Elementos esta semana",
  searches_this_week: "Búsquedas esta semana",
  rediscover: "Redescubrir",
  key_knowledge: "Conocimiento Clave",
  no_memory_items: "Aún no hay elementos de memoria.",
  categories: "Categorías",
  no_categories: "Aún no hay categorías.",
  recent_searches: "Búsquedas recientes",

  stats_heading: "Estadísticas",
  total_items: "Total de Elementos",
  total_tags: "Total de Etiquetas",
  memory_items: "Elementos de Memoria",
  items_this_week_stat: "Elementos esta Semana",
  last_7_days: "Últimos 7 días",
  items_by_type: "Elementos por Tipo",
  type: "Tipo",
  count: "Cantidad",
  no_items: "Aún no hay elementos.",

  settings_heading: "Ajustes",
  language: "Idioma",
  saved: "¡Guardado!",

  new_chat: "Nuevo Chat",
  chat_placeholder: "Pregunta a tu base de conocimiento...",
  chat_send: "Enviar",
  chat_empty: "Inicia una conversación escribiendo una pregunta abajo.",
  chat_searching: "Buscando...",
  chat_no_results: "No se encontraron resultados.",
  chat_delete_session: "Eliminar",
  chat_delete_confirm: "¿Eliminar este chat?",
};

const ptBR: Dict = {
  nav_search: "Buscar",
  nav_tags: "Tags",
  nav_insight: "Insight",
  nav_stats: "Estatísticas",
  nav_settings: "Configurações",
  subtitle: "Base de conhecimento pessoal",

  search_heading: "Buscar",
  search_placeholder: "Buscar conhecimento...",
  search_button: "Buscar",
  searching: "Buscando...",
  recent_items: "Itens recentes",
  n_results: "{n} resultados",
  no_items_found: "Nenhum item encontrado. Tente outro termo de busca.",

  untitled: "Sem título",
  summary: "Resumo",
  content: "Conteúdo",
  delete_button: "Excluir",
  delete_confirm: "Tem certeza?",

  tags_heading: "Tags",
  no_tags: "Nenhuma tag ainda.",
  n_items: "{n} itens",
  no_items_with_tag: "Nenhum item encontrado com esta tag.",

  insight_heading: "Insight",
  weekly_digest: "Resumo Semanal",
  cached: "cache",
  items_this_week: "Itens esta semana",
  searches_this_week: "Buscas esta semana",
  rediscover: "Redescobrir",
  key_knowledge: "Conhecimento Chave",
  no_memory_items: "Nenhum item de memória ainda.",
  categories: "Categorias",
  no_categories: "Nenhuma categoria ainda.",
  recent_searches: "Buscas recentes",

  stats_heading: "Estatísticas",
  total_items: "Total de Itens",
  total_tags: "Total de Tags",
  memory_items: "Itens de Memória",
  items_this_week_stat: "Itens esta Semana",
  last_7_days: "Últimos 7 dias",
  items_by_type: "Itens por Tipo",
  type: "Tipo",
  count: "Quantidade",
  no_items: "Nenhum item ainda.",

  settings_heading: "Configurações",
  language: "Idioma",
  saved: "Salvo!",

  new_chat: "Novo Chat",
  chat_placeholder: "Pergunte à sua base de conhecimento...",
  chat_send: "Enviar",
  chat_empty: "Inicie uma conversa digitando uma pergunta abaixo.",
  chat_searching: "Buscando...",
  chat_no_results: "Nenhum resultado encontrado.",
  chat_delete_session: "Excluir",
  chat_delete_confirm: "Excluir este chat?",
};

const ko: Dict = {
  nav_search: "검색",
  nav_tags: "태그",
  nav_insight: "인사이트",
  nav_stats: "통계",
  nav_settings: "설정",
  subtitle: "개인 지식 베이스",

  search_heading: "검색",
  search_placeholder: "지식 검색...",
  search_button: "검색",
  searching: "검색 중...",
  recent_items: "최근 항목",
  n_results: "{n}개 결과",
  no_items_found: "항목을 찾을 수 없습니다. 다른 검색어를 시도해 보세요.",

  untitled: "제목 없음",
  summary: "요약",
  content: "내용",
  delete_button: "삭제",
  delete_confirm: "정말 삭제하시겠습니까?",

  tags_heading: "태그",
  no_tags: "아직 태그가 없습니다.",
  n_items: "{n}개 항목",
  no_items_with_tag: "이 태그의 항목이 없습니다.",

  insight_heading: "인사이트",
  weekly_digest: "주간 다이제스트",
  cached: "캐시",
  items_this_week: "이번 주 항목",
  searches_this_week: "이번 주 검색",
  rediscover: "재발견",
  key_knowledge: "핵심 지식",
  no_memory_items: "아직 메모리 항목이 없습니다.",
  categories: "카테고리",
  no_categories: "아직 카테고리가 없습니다.",
  recent_searches: "최근 검색",

  stats_heading: "통계",
  total_items: "전체 항목",
  total_tags: "전체 태그",
  memory_items: "메모리 항목",
  items_this_week_stat: "이번 주 항목",
  last_7_days: "최근 7일",
  items_by_type: "유형별 항목",
  type: "유형",
  count: "개수",
  no_items: "아직 항목이 없습니다.",

  settings_heading: "설정",
  language: "언어",
  saved: "저장되었습니다!",

  new_chat: "새 채팅",
  chat_placeholder: "지식 베이스에 질문하세요...",
  chat_send: "전송",
  chat_empty: "아래에 질문을 입력하여 대화를 시작하세요.",
  chat_searching: "검색 중...",
  chat_no_results: "결과를 찾을 수 없습니다.",
  chat_delete_session: "삭제",
  chat_delete_confirm: "이 채팅을 삭제하시겠습니까?",
};

const DICTS: Record<Locale, Dict> = {
  en,
  ja,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  es,
  "pt-BR": ptBR,
  ko,
};

export function getDict(locale: Locale): Dict {
  return DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
}

export function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

/** Replace `{n}` placeholder in a template string */
export function fmt(template: string, n: number): string {
  return template.replace("{n}", String(n));
}
