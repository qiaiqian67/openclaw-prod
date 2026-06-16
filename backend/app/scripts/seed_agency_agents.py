"""One-off script: seed ``backend/agent_templates/`` from ``agency-agents-zh/``.

For every ``<category>/<category>-<name>.md`` under the agency-agents-zh tree,
this script produces a ``<slug>/{meta.yaml, soul.md, bootstrap.md}`` triplet
under ``backend/agent_templates/`` so that ``template_seeder.seed_agent_templates()``
(``backend/app/main.py:247``) can sync them into the ``agent_templates`` table on
the next backend restart.

LLM is used only to translate / compress Chinese persona content into the two
English-only fields the rest of the app expects to read directly:
``capability_bullets`` (2–4 short English bullets) and ``bootstrap`` (a 27-line
English onboarding template). The Chinese ``soul.md`` is stored verbatim — the
runtime prompts the agent with whatever the file contains.

Usage
-----
    cd backend
    python -m app.scripts.seed_agency_agents --dry-run --limit 3
    python -m app.scripts.seed_agency_agents

Idempotency
-----------
Skips ``<slug>/`` if it already exists unless ``--force`` is passed. Per-file
failures are isolated and recorded in ``logs/seed_agency_failures.json``; the
rest of the batch still runs.
"""
import argparse
import asyncio
import importlib.util
import json
import os
import re
import sys
from pathlib import Path
from typing import Optional

# Make `app.*` importable when this file is run as a module from anywhere.
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.scripts.seed_agency_prompts import (  # noqa: E402
    SYSTEM_PROMPT,
    USER_PROMPT_TEMPLATE,
)


def _import_llm():
    """Lazy, package-``__init__``-free import of the LLM client.

    The normal ``from app.services.llm.client import chat_complete, LLMError``
    first runs ``app/services/llm/__init__.py``, which eagerly re-exports
    symbols from ``caller.py``. ``caller.py`` then imports ``app.database``,
    which calls ``create_async_engine`` for a PostgreSQL+asyncpg URL — and
    ``asyncpg`` is not installed in this environment.

    This script only needs ``chat_complete`` and ``LLMError``, both defined
    in ``client.py``, which has no such DB dependency. So we load
    ``client.py`` directly via ``importlib.util``, skipping the package
    initialiser entirely.
    """
    client_path = PROJECT_ROOT / "app" / "services" / "llm" / "client.py"
    spec = importlib.util.spec_from_file_location("_agency_llm_client", client_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load module spec for {client_path}")
    module = importlib.util.module_from_spec(spec)
    # Must be in sys.modules before exec_module runs, otherwise submodule
    # ``from . import`` style imports inside client.py resolve to None and
    # Python raises ``AttributeError: 'NoneType' object has no attribute
    # '__dict__'`` at the first attribute lookup on the unloaded module.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module.chat_complete, module.LLMError

AGENCY_ROOT = PROJECT_ROOT.parent / "agency-agents-zh"
TEMPLATES_ROOT = PROJECT_ROOT / "agent_templates"
LOGS_ROOT = PROJECT_ROOT / "logs"
FAILURES_LOG = LOGS_ROOT / "seed_agency_failures.json"

# Slugs of the 22 hand-curated templates already under backend/agent_templates/.
# Kept in sync with the directory listing — update if you add/remove a template
# in the curated set.
EXISTING_SLUGS = {
    "backend-architect", "chief-of-staff", "code-reviewer", "content-creator",
    "cot-report-analyst", "devops-automator", "earnings-filings-analyst",
    "frontend-developer", "growth-hacker", "linkedin-content-creator",
    "macro-watcher", "market-intel-aggregator", "pre-market-briefer",
    "private-assistant", "rapid-prototyper", "risk-manager", "seo-specialist",
    "technical-analyst", "tiktok-strategist", "tilt-bias-coach",
    "trading-journal-coach", "watchlist-monitor",
}

# Of the 22 above, 10 are also present in agency-agents-zh with the same role.
# Those would collide by slug AND by display name (the seeder keys on name), so
# we rename agency copies with an ``-agency`` suffix to preserve the curated
# originals. The other 12 (chief-of-staff, all 9 trading roles, etc.) have no
# agency counterpart and need no special handling.
AGENCY_RENAME_LIST = {
    "backend-architect", "code-reviewer", "content-creator", "devops-automator",
    "frontend-developer", "growth-hacker", "linkedin-content-creator",
    "rapid-prototyper", "seo-specialist", "tiktok-strategist",
}

# 18 agency-agents-zh subdirectories that contain agent .md files → 9 of the
# 12 planned Plaza tab ids. The 3 tabs not in this map (``data-analysis``,
# ``popular``, ``office``) are either reserved slots or filled by curated
# templates only.
CATEGORY_TO_TAB = {
    "engineering": "software-development",
    "marketing": "marketing",
    "paid-media": "marketing",
    "sales": "sales",
    "support": "support",
    "design": "design",
    "product": "product",
    "project-management": "product",
    "finance": "finance",
    "hr": "support",
    "legal": "support",
    "academic": "specialized",
    "game-development": "specialized",
    "spatial-computing": "specialized",
    "testing": "specialized",
    "supply-chain": "specialized",
    "integrations": "specialized",
    "specialized": "specialized",
}

# Autonomy policy shared by all 22 existing templates — keep new ones aligned
# so the safety posture is uniform across the talent marketplace.
DEFAULT_AUTONOMY_POLICY = {
    "read_files": "L1",
    "write_workspace_files": "L1",
    "delete_files": "L2",
    "send_feishu_message": "L2",
}

# Top-level entries to skip: either not agents (strategy has runbooks), or
# auxiliary content (assets, examples, .github).
SKIP_CATEGORIES = {"strategy", "examples", "assets", ".github"}

# Matches a YAML frontmatter block at the very start of the file. We parse it
# by hand to avoid pulling in PyYAML just for a dozen scalar fields.
FRONTMATTER_RE = re.compile(
    r"\A---\s*\n(?P<yaml>.*?)\n---\s*\n(?P<body>.*)", re.DOTALL
)


def parse_md(path: Path) -> tuple[dict, str]:
    """Split a .md into (frontmatter dict, body). Returns ({}, text) on no
    frontmatter or a malformed block, so the script keeps going."""
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    meta: dict = {}
    for line in m.group("yaml").splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip().strip('"').strip("'")
    return meta, m.group("body")


def make_slug(category: str, agent_name: str, used: set) -> str:
    """Generate a unique slug of the form ``<category>-<agent-name>``.

    The seeder (``template_seeder.py:475``) keys on the human ``name`` field,
    not the slug, and the 22 curated templates use English names while
    agency-agents-zh uses Chinese names — so by construction there's no name
    collision. The slug is the on-disk directory name only; the small extra
    insurance below handles the rare case of two agency agents within the
    same category sharing a stem (already prefixed with ``<category>-`` so
    this is unlikely, but cheap to guard).
    """
    base = f"{category}-{agent_name}"
    candidate = base
    n = 0
    while candidate in used:
        n += 1
        candidate = f"{base}-{n}"
    used.add(candidate)
    return candidate


def _parse_json_response(content: str) -> dict:
    """Strip any ``\\`\\`\\`json`` fences the LLM sometimes adds, then json.loads."""
    s = content.strip()
    if s.startswith("```"):
        first_newline = s.find("\n")
        s = s[first_newline + 1:]
        if s.endswith("```"):
            s = s[:-3].rstrip()
    return json.loads(s)


async def call_llm_for_metadata(
    name: str,
    body: str,
    category: str,
    provider: str,
    api_key: str,
    model: str,
    base_url: Optional[str],
) -> dict:
    """Call the LLM, retry once on parse/transport failure.

    Returns a dict with keys ``capability_bullets`` (list[str], 2–4 items) and
    ``bootstrap`` (str, ~27 lines). Raises ``LLMError`` if both attempts fail
    or the model keeps returning unparseable JSON.
    """
    user_msg = USER_PROMPT_TEMPLATE.format(name=name, category=category, body=body)
    chat_complete, LLMError = _import_llm()
    last_error: Optional[Exception] = None
    for _ in range(2):
        try:
            resp = await chat_complete(
                provider=provider,
                api_key=api_key,
                model=model,
                base_url=base_url,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.4,
                max_tokens=1500,
                timeout=120.0,
            )
            content = resp["choices"][0]["message"]["content"]
            return _parse_json_response(content)
        except (LLMError, json.JSONDecodeError, KeyError, IndexError) as e:
            last_error = e
            continue
    raise LLMError(f"LLM call failed after retry: {last_error}")


def build_meta_yaml(
    name: str,
    description: str,
    icon: str,
    category: str,
    bullets: list,
    autonomy: dict,
) -> str:
    """Render a meta.yaml string matching the format of the existing 22
    templates under ``backend/agent_templates/``."""
    lines = [
        f'name: "{name}"',
        f'description: "{description}"',
        f'icon: "{icon}"',
        f'category: "{category}"',
        "capability_bullets:",
    ]
    for b in bullets:
        escaped = b.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'  - "{escaped}"')
    lines.append("default_skills: []")
    lines.append("default_mcp_servers: []")
    lines.append("default_autonomy_policy:")
    for k, v in autonomy.items():
        lines.append(f'  {k}: "{v}"')
    return "\n".join(lines) + "\n"


def discover_agents(agency_root: Path) -> list[tuple[Path, str]]:
    """Return ``[(md_path, category), ...]`` for every agent .md under the tree."""
    out: list[tuple[Path, str]] = []
    for cat_dir in sorted(p for p in agency_root.iterdir() if p.is_dir()):
        if cat_dir.name in SKIP_CATEGORIES:
            continue
        for md in sorted(cat_dir.glob("*.md")):
            out.append((md, cat_dir.name))
    return out


async def process_one(
    md_path: Path,
    category: str,
    used_slugs: set,
    sem: asyncio.Semaphore,
    provider: str,
    api_key: str,
    model: str,
    base_url: Optional[str],
    dry_run: bool,
    force: bool,
) -> dict:
    """Process a single .md file. Returns a status dict for the summary."""
    meta, body = parse_md(md_path)
    name = meta.get("name") or md_path.stem
    description = meta.get("description") or ""
    emoji = meta.get("emoji") or "🤖"

    tab_category = CATEGORY_TO_TAB.get(category)
    if tab_category is None:
        return {
            "path": str(md_path),
            "status": "skipped",
            "reason": f"unmapped category: {category}",
        }

    # Strip the ``<category>-`` prefix from the file stem to get the bare role
    # name. ``engineering-backend-architect.md`` -> ``backend-architect``.
    agent_name_part = md_path.stem
    prefix = f"{category}-"
    if agent_name_part.startswith(prefix):
        agent_name_part = agent_name_part[len(prefix):]
    slug = make_slug(category, agent_name_part, used_slugs)

    target_dir = TEMPLATES_ROOT / slug
    if target_dir.exists() and not force:
        return {"path": str(md_path), "slug": slug, "status": "exists"}

    if dry_run:
        return {"path": str(md_path), "slug": slug, "status": "dry-run", "name": name}

    async with sem:
        try:
            llm_result = await call_llm_for_metadata(
                name=name, body=body, category=category,
                provider=provider, api_key=api_key, model=model, base_url=base_url,
            )
        except Exception as e:
            return {
                "path": str(md_path), "slug": slug,
                "status": "llm_failed", "error": repr(e),
            }

    bullets = llm_result.get("capability_bullets", [])
    bootstrap = (llm_result.get("bootstrap") or "").strip()
    if not isinstance(bullets, list) or len(bullets) < 2:
        return {
            "path": str(md_path), "slug": slug,
            "status": "bad_bullets", "bullets": bullets,
        }

    target_dir.mkdir(parents=True, exist_ok=True)
    (target_dir / "meta.yaml").write_text(
        build_meta_yaml(name, description, emoji, tab_category, bullets, DEFAULT_AUTONOMY_POLICY),
        encoding="utf-8",
    )
    (target_dir / "soul.md").write_text(body, encoding="utf-8")
    if bootstrap:
        (target_dir / "bootstrap.md").write_text(bootstrap + "\n", encoding="utf-8")

    return {
        "path": str(md_path), "slug": slug, "status": "ok",
        "name": name, "category": tab_category, "bullets_n": len(bullets),
    }


async def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true",
                   help="Discover all agents, plan slugs, but skip LLM and disk writes.")
    p.add_argument("--limit", type=int, default=0,
                   help="Process at most N files (0 = all). Useful for spot-checks.")
    p.add_argument("--force", action="store_true",
                   help="Overwrite an existing <slug>/ directory.")
    p.add_argument("--provider", default=os.environ.get("AGENCY_LLM_PROVIDER", "deepseek"),
                   help="LLM provider id (default: deepseek).")
    p.add_argument("--model", default=os.environ.get("AGENCY_LLM_MODEL", "deepseek-chat"),
                   help="LLM model id (default: deepseek-chat).")
    p.add_argument("--base-url", default=os.environ.get("AGENCY_LLM_BASE_URL"),
                   help="Optional base URL override (provider default if unset).")
    p.add_argument("--api-key", default=None,
                   help=f"LLM API key. Default: read ${{PROVIDER}}_API_KEY (uppercased).")
    p.add_argument("--concurrency", type=int, default=8,
                   help="Max concurrent LLM calls (default: 8).")
    args = p.parse_args()

    api_key = args.api_key or os.environ.get(f"{args.provider.upper()}_API_KEY")
    if not api_key and not args.dry_run:
        print(
            f"ERROR: missing API key. Pass --api-key or set {args.provider.upper()}_API_KEY.",
            file=sys.stderr,
        )
        return 2

    if not AGENCY_ROOT.exists():
        print(f"ERROR: agency root not found: {AGENCY_ROOT}", file=sys.stderr)
        return 2

    agents = discover_agents(AGENCY_ROOT)
    if args.limit:
        agents = agents[: args.limit]
    print(f"Discovered {len(agents)} agent .md files under {AGENCY_ROOT}")
    if args.dry_run:
        print("(dry-run: LLM calls and disk writes skipped)")

    used_slugs: set[str] = set()
    sem = asyncio.Semaphore(args.concurrency)

    tasks = [
        process_one(
            md, cat, used_slugs, sem,
            args.provider, api_key, args.model, args.base_url,
            args.dry_run, args.force,
        )
        for md, cat in agents
    ]
    results = await asyncio.gather(*tasks)

    by_status: dict[str, int] = {}
    for r in results:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1
    print("Summary:", by_status)

    failures = [r for r in results if r["status"] in ("llm_failed", "bad_bullets")]
    if failures:
        LOGS_ROOT.mkdir(parents=True, exist_ok=True)
        FAILURES_LOG.write_text(
            json.dumps(failures, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"Wrote {len(failures)} failure(s) to {FAILURES_LOG}")

    if args.dry_run:
        print("\nFirst 10 planned (path -> slug):")
        for r in results[:10]:
            print(f"  {r['path']}  ->  {r.get('slug', '?')}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
