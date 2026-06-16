"""Batch-translate ``capability_bullets`` in agent_templates/*/meta.yaml from
English to Chinese.

Backend (template_seeder) reads ``meta.yaml`` and upserts into the
``agent_templates`` table on every restart; Plaza's TemplateCard renders the
bullets verbatim. The recently-imported 200+ templates have Chinese ``name``
and ``description`` but English ``capability_bullets``, leaving the talent
market cards mixed-language under zh-CN.

This script:
  1) walks ``backend/agent_templates/*/meta.yaml``
  2) skips entries whose bullets already contain CJK characters
  3) calls the Anthropic-compatible LLM (driven by ANTHROPIC_BASE_URL,
     ANTHROPIC_API_KEY, ANTHROPIC_DEFAULT_HAIKU_MODEL) to translate each
     bullet list, preserving the "**Label** — phrase" shape
  4) rewrites only the ``capability_bullets:`` block in-place, byte-for-byte
     identical elsewhere — so YAML quoting/comments/field order outside the
     block survive untouched
  5) keeps a backup at ``meta.yaml.en.bak`` on first edit (idempotent)
  6) records failures in ``backend/logs/translate_bullets_failures.json``

Usage
-----
    cd backend
    python -m app.scripts.translate_capability_bullets --dry-run --limit 3
    python -m app.scripts.translate_capability_bullets

After it finishes, restart the backend so template_seeder re-upserts the new
bullets, then refresh Plaza in the desktop client.
"""
import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
TEMPLATES_ROOT = PROJECT_ROOT / "agent_templates"
LOGS_ROOT = PROJECT_ROOT / "logs"
FAILURES_LOG = LOGS_ROOT / "translate_bullets_failures.json"

CJK_RE = re.compile(r"[一-鿿]")
# Match the entire capability_bullets list block. We rely on the fact that
# every meta.yaml in this repo has "default_skills:" immediately following
# (verified: 224/224). Capturing up to but not including that next key keeps
# any blank lines between blocks attached to the *replacement*, so we don't
# accidentally collapse formatting.
BULLETS_BLOCK_RE = re.compile(
    # MULTILINE only — no DOTALL: ``.`` must NOT cross newlines, otherwise
    # the bullet line "- "..." " repeats greedily and swallows non-bullet
    # following lines like ``default_skills: []`` (also matched by ``.``).
    r"(?m)^(capability_bullets:[ \t]*\n(?:[ \t]+-[ \t].*\n)+)(?=[a-z_])"
)
BULLET_LINE_RE = re.compile(r'^[ \t]+-[ \t]+"((?:[^"\\]|\\.)*)"[ \t]*$')


def _import_anthropic():
    try:
        from anthropic import Anthropic  # type: ignore
    except ImportError:
        sys.stderr.write(
            "anthropic SDK not installed. Run: pip install anthropic\n"
        )
        sys.exit(2)
    return Anthropic


def _make_client():
    Anthropic = _import_anthropic()
    base_url = os.environ.get("ANTHROPIC_BASE_URL")
    api_key = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get(
        "ANTHROPIC_AUTH_TOKEN"
    )
    if not api_key:
        sys.stderr.write("ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) is not set.\n")
        sys.exit(2)
    return Anthropic(api_key=api_key, base_url=base_url)


def _model_name() -> str:
    return (
        os.environ.get("ANTHROPIC_DEFAULT_HAIKU_MODEL")
        or os.environ.get("ANTHROPIC_MODEL")
        or "ark-code-latest"
    )


SYSTEM_PROMPT = (
    "你是一个专注于将英文 agent capability bullets 翻译为简体中文的助手。"
    "输入是一段 JSON 数组，每个元素是一条形如 "
    '"Label — short phrase describing the capability" 的英文短语，'
    "其中 — 可能写作 -- 或 -。\n"
    "翻译规则：\n"
    "1. 保留 Label 与短语之间的 ' — '（前后各一个空格的全角破折号风格）；\n"
    "2. Label 翻译成贴合中文的 2-6 字短语，要专业、自然，不要直译；\n"
    "3. 短语翻成自然中文，不超过原文 1.3 倍长度，保留专业术语缩写"
    "（如 OWASP、SOC2、KOL、ROI、KPI、ARR、CRM、ERP、SLA、SLO 等保持英文）；\n"
    "4. 不要加 markdown 加粗，不要加引号，不要加编号；\n"
    "5. 输出严格的 JSON 数组，元素数量、顺序与输入一致。\n"
    "只输出 JSON，不要任何解释。"
)


def translate_bullets(client, bullets: list[str]) -> list[str]:
    """One LLM call → translated bullet list. Raises on shape mismatch."""
    payload = json.dumps(bullets, ensure_ascii=False)
    msg = client.messages.create(
        model=_model_name(),
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": payload}],
    )
    text = "".join(
        block.text for block in msg.content if getattr(block, "type", None) == "text"
    ).strip()
    # Strip optional ```json fences the model might add anyway
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S)
    parsed = json.loads(text)
    if not isinstance(parsed, list) or len(parsed) != len(bullets):
        raise ValueError(f"shape mismatch: got {parsed!r}")
    out: list[str] = []
    for b in parsed:
        if not isinstance(b, str) or not b.strip():
            raise ValueError(f"non-string bullet: {b!r}")
        # Trim accidental wrapping quotes
        s = b.strip()
        if (s.startswith('"') and s.endswith('"')) or (
            s.startswith("'") and s.endswith("'")
        ):
            s = s[1:-1]
        out.append(s)
    return out


def _yaml_quote(s: str) -> str:
    """Minimal YAML double-quoted scalar escape."""
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _replace_bullets_block(text: str, new_bullets: list[str]) -> str:
    def repl(m: re.Match) -> str:
        # Preserve indentation of the first bullet line if present.
        first_line = m.group(1).splitlines()[1] if "\n" in m.group(1) else "  - "
        m_indent = re.match(r"^([ \t]+)-", first_line)
        indent = m_indent.group(1) if m_indent else "  "
        lines = ["capability_bullets:"]
        for b in new_bullets:
            lines.append(f"{indent}- {_yaml_quote(b)}")
        return "\n".join(lines) + "\n"

    new_text, n = BULLETS_BLOCK_RE.subn(repl, text, count=1)
    if n != 1:
        raise ValueError("capability_bullets block not found")
    return new_text


def _extract_bullets(text: str) -> tuple[list[str], list[int]]:
    """Pull the current bullets out of a meta.yaml's bullets block.

    Returns (bullets, [start_byte, end_byte]) — start/end aren't used today
    but make it easy to add a YAML re-quoting fallback later if needed.
    """
    m = BULLETS_BLOCK_RE.search(text)
    if not m:
        return [], []
    bullets: list[str] = []
    for line in m.group(1).splitlines()[1:]:
        line_m = BULLET_LINE_RE.match(line)
        if line_m:
            # Unescape standard YAML double-quoted escapes we generate.
            raw = line_m.group(1).replace('\\"', '"').replace("\\\\", "\\")
            bullets.append(raw)
        else:
            stripped = line.strip()
            if stripped.startswith("- "):
                # Single-quoted or unquoted form — fall back to bare slice.
                bullets.append(stripped[2:].strip().strip("'\""))
    return bullets, [m.start(), m.end()]


def _is_translated(bullets: list[str]) -> bool:
    if not bullets:
        return True
    return all(CJK_RE.search(b) for b in bullets)


def _save_failure(slug: str, error: str, bullets: list[str]) -> None:
    LOGS_ROOT.mkdir(parents=True, exist_ok=True)
    payload: dict[str, object] = {}
    if FAILURES_LOG.exists():
        try:
            payload = json.loads(FAILURES_LOG.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            payload = {}
    payload[slug] = {"error": error, "bullets": bullets, "ts": time.time()}
    FAILURES_LOG.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--force", action="store_true",
                        help="re-translate even if bullets are already CJK")
    args = parser.parse_args()

    if not TEMPLATES_ROOT.exists():
        sys.stderr.write(f"templates root not found: {TEMPLATES_ROOT}\n")
        return 2

    client = None if args.dry_run else _make_client()

    targets = sorted(TEMPLATES_ROOT.iterdir())
    done = skipped = failed = 0
    for d in targets:
        meta = d / "meta.yaml"
        if not meta.is_file():
            continue
        text = meta.read_text(encoding="utf-8")
        bullets, _ = _extract_bullets(text)
        if not bullets:
            continue
        if _is_translated(bullets) and not args.force:
            skipped += 1
            continue
        if args.limit and done >= args.limit:
            break

        print(f"[{d.name}] translating {len(bullets)} bullet(s)...")
        if args.dry_run:
            for b in bullets:
                print(f"    EN: {b}")
            done += 1
            continue

        try:
            zh = translate_bullets(client, bullets)
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"    !! failed: {e}")
            _save_failure(d.name, str(e), bullets)
            continue

        backup = meta.with_suffix(".yaml.en.bak")
        if not backup.exists():
            backup.write_text(text, encoding="utf-8")

        try:
            new_text = _replace_bullets_block(text, zh)
        except ValueError as e:
            failed += 1
            print(f"    !! rewrite failed: {e}")
            _save_failure(d.name, f"rewrite: {e}", bullets)
            continue

        meta.write_text(new_text, encoding="utf-8")
        for src, dst in zip(bullets, zh):
            print(f"    {src}\n    → {dst}")
        done += 1

    print(
        f"\nsummary: translated={done} skipped={skipped} failed={failed}"
    )
    if FAILURES_LOG.exists() and failed:
        print(f"see {FAILURES_LOG} for details")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
