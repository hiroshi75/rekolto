import type { Context } from "grammy";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../../utils/logger.js";
import { loadConfig } from "../../utils/config.js";
import { summarizeContent, extractMemoryFacts } from "../../services/ai.js";
import { createItem } from "../../db/items.js";
import { addTagsToItem } from "../../db/tags.js";
import { findOrCreateCategory, createMemoryItem } from "../../db/memory-store.js";

/**
 * Extract text from an image using Gemini Vision.
 */
async function extractTextFromImage(imageBase64: string, mimeType: string): Promise<string> {
  const config = loadConfig();
  const profile = config.llm.profiles["default"];

  const genAI = new GoogleGenerativeAI(profile.api_key);
  const model = genAI.getGenerativeModel({ model: profile.model });

  const result = await model.generateContent([
    {
      inlineData: {
        data: imageBase64,
        mimeType,
      },
    },
    {
      text: "この画像に含まれるすべてのテキストを正確に抽出してください。テキストが見つからない場合は、画像の内容を簡潔に説明してください。テキスト以外の説明は不要です。",
    },
  ]);

  return result.response.text();
}

/**
 * Handle image messages: OCR via Gemini Vision, then save as a memo.
 */
export async function handleImage(ctx: Context): Promise<void> {
  // Support both photo and document (for full-resolution images sent as files)
  const photo = ctx.message?.photo;
  const doc = ctx.message?.document;

  let fileId: string | undefined;
  let mimeType = "image/jpeg";

  if (photo && photo.length > 0) {
    // Pick the largest photo size (last in the array)
    fileId = photo[photo.length - 1].file_id;
  } else if (doc && doc.mime_type?.startsWith("image/")) {
    fileId = doc.file_id;
    mimeType = doc.mime_type;
  }

  if (!fileId) return;

  const statusMsg = await ctx.reply("⏳ 画像を処理中...");

  try {
    // Get the file info from Telegram
    const file = await ctx.api.getFile(fileId);

    if (!file.file_path) {
      throw new Error("Telegram did not return a file_path");
    }

    const config = loadConfig();
    const botToken = config.telegram.bot_token;
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;

    // Download the image
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString("base64");

    // Extract text via Gemini Vision
    logger.info("Extracting text from image via Gemini Vision");
    const extractedText = await extractTextFromImage(imageBase64, mimeType);

    if (!extractedText || extractedText.trim().length === 0) {
      await ctx.api.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        "⚠️ 画像からテキストを抽出できませんでした。",
      );
      return;
    }

    // Treat the extracted text like a memo: summarize, tag, save
    const caption = ctx.message?.caption;
    const contentForAI = caption
      ? `[キャプション] ${caption}\n\n[抽出テキスト]\n${extractedText}`
      : extractedText;

    const [summary, memoryResult] = await Promise.all([
      summarizeContent(contentForAI),
      extractMemoryFacts(contentForAI),
    ]);

    // Create item in DB
    const item = createItem({
      type: summary.type,
      content: contentForAI,
      summary: summary.summary,
    });

    // Add tags
    if (summary.tags.length > 0) {
      addTagsToItem(item.id, summary.tags);
    }

    // Store memory facts
    for (const fact of memoryResult.facts) {
      const category = findOrCreateCategory(memoryResult.category);
      createMemoryItem({
        category_id: category.id,
        type: fact.type,
        content: fact.content,
        source_id: item.id,
      });
    }

    // Format tags for display
    const tagsDisplay = summary.tags.map((t) => `#${t}`).join(" ");

    // Build response
    const lines = [
      "✅ 画像から保存しました！",
      `📝 ${summary.summary}`,
    ];

    // Show a snippet of the extracted text
    const textPreview = extractedText.slice(0, 200);
    lines.push(`📷 抽出テキスト: ${textPreview}${extractedText.length > 200 ? "..." : ""}`);

    if (tagsDisplay) {
      lines.push(`🏷️ ${tagsDisplay}`);
    }
    lines.push(`🆔 ${item.id}`);

    const responseText = lines.join("\n");

    await ctx.api.editMessageText(
      statusMsg.chat.id,
      statusMsg.message_id,
      responseText,
    );

    logger.info({ itemId: item.id, type: summary.type, tags: summary.tags }, "Image memo saved");
  } catch (err) {
    logger.error({ err }, "Failed to handle image");

    try {
      await ctx.api.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        "❌ 画像の処理に失敗しました。もう一度お試しください。",
      );
    } catch {
      await ctx.reply("❌ 画像の処理に失敗しました。もう一度お試しください。");
    }
  }
}
