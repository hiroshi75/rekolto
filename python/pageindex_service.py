"""
PageIndex Service — LLM-based document tree indexing and search.

A simple Flask HTTP server that listens on localhost:8765.
- POST /index — accepts {content, title} and returns a tree structure
- POST /search — accepts {tree_json, query} and returns matched sections

Uses Google Generative AI (Gemini) for intelligent content segmentation and search.
"""

import json
import os
import re
import sys
from flask import Flask, request, jsonify
import google.generativeai as genai

app = Flask(__name__)

# ---------------------------------------------------------------------------
# LLM configuration
# ---------------------------------------------------------------------------

_model = None


def get_model():
    global _model
    if _model is not None:
        return _model

    api_key = os.environ.get("GOOGLE_API_KEY", "")
    model_name = os.environ.get("PAGEINDEX_MODEL", "gemini-2.5-flash")

    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY environment variable is not set")

    genai.configure(api_key=api_key)
    _model = genai.GenerativeModel(model_name)
    return _model


def llm_generate(prompt: str, *, temperature: float = 0.2, max_tokens: int = 4096) -> str:
    """Call the LLM and return the text response."""
    model = get_model()
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        ),
    )
    return response.text


def parse_json_response(raw: str):
    """Parse a JSON response from the LLM, stripping markdown code blocks."""
    cleaned = raw.strip()
    match = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?\s*```", cleaned)
    if match:
        cleaned = match.group(1).strip()
    return json.loads(cleaned)


# ---------------------------------------------------------------------------
# Tree indexing
# ---------------------------------------------------------------------------

INDEX_SYSTEM_PROMPT = """You are a document structure analyzer. Given a document's title and content, segment it into a hierarchical tree of sections.

Return a JSON object with the following structure:
{
  "title": "Document title",
  "sections": [
    {
      "id": "s1",
      "title": "Section Title",
      "content": "The section's content text (keep the original text, do NOT summarize)",
      "path": "Section Title",
      "children": [
        {
          "id": "s1.1",
          "title": "Subsection Title",
          "content": "Subsection content text",
          "path": "Section Title > Subsection Title",
          "children": []
        }
      ]
    }
  ]
}

Rules:
- Segment the document by headings, logical topic boundaries, or paragraphs.
- Each section must have: id, title, content, path, children (array, may be empty).
- The "path" field is a breadcrumb trail using " > " as separator.
- The "content" field should contain the actual text of that section (NOT a summary).
- Preserve the original content faithfully. Do not omit or shorten it.
- Create a reasonable hierarchy (2-4 levels max).
- For short documents, a flat list of sections is fine.
- Return ONLY valid JSON, no other text."""


def build_fallback_tree(content: str, title: str) -> dict:
    """Build a simple tree by splitting on blank lines / headings as a fallback."""
    sections = []
    # Split by markdown headings or double newlines
    parts = re.split(r"\n(?=#{1,4}\s)|(?:\n\s*\n)", content)
    parts = [p.strip() for p in parts if p.strip()]

    for i, part in enumerate(parts):
        heading_match = re.match(r"^(#{1,4})\s+(.+?)$", part, re.MULTILINE)
        if heading_match:
            sec_title = heading_match.group(2).strip()
            sec_content = part[heading_match.end():].strip()
        else:
            sec_title = f"Section {i + 1}"
            sec_content = part

        sections.append({
            "id": f"s{i + 1}",
            "title": sec_title,
            "content": sec_content,
            "path": sec_title,
            "children": [],
        })

    return {
        "title": title,
        "sections": sections,
    }


@app.route("/index", methods=["POST"])
def index_document():
    """Accept {content, title} and return a PageIndex tree JSON."""
    data = request.get_json(force=True)
    content = data.get("content", "")
    title = data.get("title", "Untitled")

    if not content:
        return jsonify({"error": "content is required"}), 400

    # Truncate very long content for the LLM prompt (keep first 30k chars)
    truncated = content[:30000] if len(content) > 30000 else content

    prompt = f"""{INDEX_SYSTEM_PROMPT}

Document Title: {title}

Document Content:
{truncated}"""

    try:
        raw = llm_generate(prompt, temperature=0.1, max_tokens=8192)
        tree = parse_json_response(raw)

        # Validate basic structure
        if "sections" not in tree:
            tree = {"title": title, "sections": []}
        if "title" not in tree:
            tree["title"] = title

        return jsonify(tree)

    except Exception as e:
        print(f"[pageindex] LLM indexing failed, using fallback: {e}", file=sys.stderr)
        # Fall back to simple structural parsing
        tree = build_fallback_tree(content, title)
        return jsonify(tree)


# ---------------------------------------------------------------------------
# Tree search
# ---------------------------------------------------------------------------

SEARCH_SYSTEM_PROMPT = """You are a document search assistant. Given a document's tree structure (JSON) and a search query, find the most relevant sections.

Return a JSON object:
{
  "sections": [
    {
      "title": "Section Title",
      "content": "The relevant content from this section",
      "path": "Parent > Section Title",
      "relevance": 0.95
    }
  ]
}

Rules:
- Return sections sorted by relevance (highest first).
- Maximum 5 most relevant sections.
- The "relevance" field is a float from 0.0 to 1.0.
- Only include sections that are actually relevant to the query.
- If no sections are relevant, return {"sections": []}.
- Return ONLY valid JSON, no other text."""


def text_search_tree(tree: dict, query: str) -> list:
    """Simple keyword-based fallback search over the tree sections."""
    query_lower = query.lower()
    query_words = set(query_lower.split())
    results = []

    def walk(sections, parent_path=""):
        for sec in sections:
            content_lower = sec.get("content", "").lower()
            title_lower = sec.get("title", "").lower()
            combined = title_lower + " " + content_lower

            # Score based on word matches
            score = 0.0
            for word in query_words:
                if word in combined:
                    score += 1.0 / len(query_words)

            if score > 0:
                results.append({
                    "title": sec.get("title", ""),
                    "content": sec.get("content", "")[:500],
                    "path": sec.get("path", parent_path),
                    "relevance": min(score, 1.0),
                })

            children = sec.get("children", [])
            if children:
                walk(children, sec.get("path", ""))

    sections = tree.get("sections", [])
    walk(sections)

    results.sort(key=lambda x: x["relevance"], reverse=True)
    return results[:5]


@app.route("/search", methods=["POST"])
def search_document():
    """Accept {tree_json, query} and return matched sections."""
    data = request.get_json(force=True)
    tree_json_str = data.get("tree_json", "")
    query = data.get("query", "")

    if not tree_json_str or not query:
        return jsonify({"error": "tree_json and query are required"}), 400

    try:
        tree = json.loads(tree_json_str) if isinstance(tree_json_str, str) else tree_json_str
    except json.JSONDecodeError:
        return jsonify({"error": "invalid tree_json"}), 400

    # Truncate tree JSON for the LLM prompt
    tree_str = json.dumps(tree, ensure_ascii=False)
    if len(tree_str) > 30000:
        tree_str = tree_str[:30000]

    prompt = f"""{SEARCH_SYSTEM_PROMPT}

Document Tree:
{tree_str}

Search Query: {query}"""

    try:
        raw = llm_generate(prompt, temperature=0.1, max_tokens=4096)
        result = parse_json_response(raw)

        if "sections" not in result:
            result = {"sections": []}

        return jsonify(result)

    except Exception as e:
        print(f"[pageindex] LLM search failed, using fallback: {e}", file=sys.stderr)
        # Fall back to simple text search
        sections = text_search_tree(tree, query)
        return jsonify({"sections": sections})


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PAGEINDEX_PORT", "8765"))
    print(f"[pageindex] Starting PageIndex service on port {port}", file=sys.stderr)
    app.run(host="127.0.0.1", port=port, debug=False)
