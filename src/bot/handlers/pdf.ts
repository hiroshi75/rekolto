import type { Context } from "grammy";
import { PDFParse } from "pdf-parse";
import { logger } from "../../utils/logger.js";
import { loadConfig } from "../../utils/config.js";
import { summarizeContent, extractMemoryFacts } from "../../services/ai.js";
import { indexDocument } from "../../services/pageindex-bridge.js";
import { createItem } from "../../db/items.js";
import { addTagsToItem } from "../../db/tags.js";
import { savePageIndex } from "../../db/page-indices.js";
import { findOrCreateCategory, createMemoryItem } from "../../db/memory-store.js";

/**
 * Extract text content from a PDF buffer using pdf-parse v2.
 */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; numPages: number }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const textResult = await parser.getText();
  const numPages = textResult.total;
  const text = textResult.text;
  await parser.destroy();
  return { text, numPages };
}

/**
 * Handle PDF file uploads from Telegram.
 * Downloads the PDF, extracts text, summarizes, creates item, and optionally generates PageIndex.
 */
export async function handlePdf(ctx: Context): Promise<void> {
  const document = ctx.message?.document;
  if (!document) {
    await ctx.reply("PDF ファイルが見つかりません。");
    return;
  }

  const statusMsg = await ctx.reply("⏳ PDF を処理中...");

  try {
    // Download the PDF file
    const file = await ctx.api.getFile(document.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const { text, numPages } = await extractPdfText(buffer);

    if (!text || text.trim().length === 0) {
      await ctx.api.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        "⚠️ PDF からテキストを抽出できませんでした。画像ベースの PDF かもしれません。"
      );
      return;
    }

    const config = loadConfig();
    const fileName = document.file_name || "document.pdf";
    const title = fileName.replace(/\.pdf$/i, "");

    // Truncate content if too long
    const maxContentLength = config.scraper.max_content_length;
    const content =
      text.length > maxContentLength ? text.slice(0, maxContentLength) : text;

    // AI: summarize content and extract memory facts in parallel
    const [summary, memoryResult] = await Promise.all([
      summarizeContent(content, title),
      extractMemoryFacts(content, title),
    ]);

    // Create item in DB
    const item = createItem({
      type: summary.type,
      title,
      content,
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

    // PageIndex: generate tree if content is long enough
    let hasPageIndex = false;
    if (content.length >= config.pageindex.min_content_length_for_tree) {
      try {
        await ctx.api.editMessageText(
          statusMsg.chat.id,
          statusMsg.message_id,
          "⏳ PDF を処理中... (ページインデックス生成中)"
        );

        const treeJson = await indexDocument(content, title);
        savePageIndex(item.id, treeJson, numPages);
        hasPageIndex = true;

        logger.info(
          { itemId: item.id, numPages },
          "PageIndex tree generated for PDF"
        );
      } catch (err) {
        logger.warn(
          { err, itemId: item.id },
          "Failed to generate PageIndex tree for PDF"
        );
        // Continue without PageIndex — not critical
      }
    }

    // Format tags for display
    const tagsDisplay = summary.tags.map((t) => `#${t}`).join(" ");

    // Build response
    const lines = [
      "✅ PDF を保存しました！",
      `📄 ${title}`,
      `📝 ${summary.summary}`,
      `📃 ${numPages} ページ`,
    ];
    if (hasPageIndex) {
      lines.push("🗂️ ページインデックス生成済み");
    }
    if (tagsDisplay) {
      lines.push(`🏷️ ${tagsDisplay}`);
    }
    lines.push(`🆔 ${item.id}`);

    const responseText = lines.join("\n");

    await ctx.api.editMessageText(
      statusMsg.chat.id,
      statusMsg.message_id,
      responseText
    );

    logger.info(
      {
        itemId: item.id,
        title,
        type: summary.type,
        numPages,
        hasPageIndex,
      },
      "PDF saved"
    );
  } catch (err) {
    logger.error({ err }, "Failed to handle PDF");

    try {
      await ctx.api.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        "❌ PDF の処理に失敗しました。もう一度お試しください。"
      );
    } catch {
      await ctx.reply("❌ PDF の処理に失敗しました。もう一度お試しください。");
    }
  }
}
