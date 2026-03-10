#!/usr/bin/env python3
"""
Minimal runner for repository auto-prompt hooks.

Usage:
  python scripts/run_auto_prompts.py --config .github/auto-prompts.yml

This script is intentionally minimal and pluggable: implement an Agent subclass
to call your real agent/CLI/API. The default LocalAgent echoes prompts.
"""
import argparse
import os
import sys
import logging
from pathlib import Path

try:
    import yaml
except Exception:
    yaml = None

LOG_FILE = Path('.github/auto-prompts.log')


class AgentResult:
    def __init__(self, finished: bool, output: str = "", would_commit: bool = False, changed_files=None):
        self.finished = finished
        self.output = output
        self.would_commit = would_commit
        self.changed_files = changed_files or []


class AgentInterface:
    def execute(self, prompt: str) -> AgentResult:
        """Override to call real agent/SDK/CLI. Return AgentResult."""
        raise NotImplementedError()


class LocalAgent(AgentInterface):
    def execute(self, prompt: str) -> AgentResult:
        # Simple echo agent for demonstration
        out = f"[LocalAgent] Executed prompt: {prompt}\n"
        # If prompt contains the token "COMMIT:" we simulate a change
        would_commit = "COMMIT:" in prompt
        changed = ["example.txt"] if would_commit else []
        return AgentResult(finished=True, output=out, would_commit=would_commit, changed_files=changed)


def load_config(path: Path):
    if not path.exists():
        raise FileNotFoundError(path)
    if yaml is None:
        raise RuntimeError("PyYAML is required. Install scripts/requirements.txt or `pip install pyyaml`.")
    with path.open('r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def log_entry(text: str):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open('a', encoding='utf-8') as fh:
        fh.write(text + "\n")


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='.github/auto-prompts.yml')
    parser.add_argument('--depth', type=int, default=0)
    parser.add_argument('--agent', choices=['local'], default='local')
    args = parser.parse_args(argv)

    cfg_path = Path(args.config)
    cfg = load_config(cfg_path)

    if not cfg.get('enabled'):
        print('Auto-prompts are disabled in config.')
        return 0

    max_depth = int(cfg.get('max_chain_depth', 2))
    if args.depth >= max_depth:
        print(f"Max chain depth reached ({args.depth} >= {max_depth}). Exiting.")
        return 0

    hooks = cfg.get('hooks', []) or []
    agent: AgentInterface = LocalAgent()

    for hook in hooks:
        if hook.get('trigger') != 'on_completion':
            continue
        name = hook.get('name')
        prompt = hook.get('prompt')
        print(f"Running hook: {name}")
        result = agent.execute(prompt)
        log_entry(f"HOOK:{name} OUTPUT:\n{result.output}")

        if result.would_commit or hook.get('requires_confirmation_for_commits'):
            # Do not auto-commit. Save patch placeholder and log.
            pending_dir = Path('.github/auto-prompts-pending')
            pending_dir.mkdir(parents=True, exist_ok=True)
            pending_file = pending_dir / f"{name}.txt"
            with pending_file.open('w', encoding='utf-8') as pf:
                pf.write(f"Hook: {name}\nPrompt: {prompt}\n\nAgent output:\n{result.output}\n\nChanged files: {result.changed_files}\n")
            log_entry(f"HOOK:{name} PENDING_CHANGE: {pending_file}")
            print(f"Hook {name} produced changes. Saved pending file: {pending_file}. Commit requires manual confirmation.")
        else:
            print(f"Hook {name} completed with no commit-worthy changes.")

    return 0


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    sys.exit(main())
