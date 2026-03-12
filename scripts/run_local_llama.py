"""Run a local gguf model using llama-cpp-python.

Usage:
- Ensure `llama-cpp-python` is installed: `pip install llama-cpp-python`
- Set `LLM_MODEL` env var to full path to the .gguf file or to the directory containing it.
- Run: `python scripts/run_local_llama.py`
"""
import os
import sys
from pathlib import Path


def find_gguf(path: Path):
    if path.is_file() and path.suffix.lower() == '.gguf':
        return str(path)
    if path.is_dir():
        for p in path.iterdir():
            if p.suffix.lower() == '.gguf':
                return str(p)
    return None


def main():
    model_env = os.getenv('LLM_MODEL')
    # default repo cache
    default_cache = Path(__file__).resolve().parents[1] / '.cache' / 'gpt4all'
    candidate = Path(model_env) if model_env else default_cache

    model_path = find_gguf(candidate)
    if not model_path:
        print('No .gguf model found. Set LLM_MODEL to a .gguf path or place .gguf in', default_cache)
        sys.exit(2)

    try:
        from llama_cpp import Llama
    except Exception as e:
        print('Missing dependency: please install `llama-cpp-python` (pip install llama-cpp-python)')
        print('Import error:', e)
        sys.exit(2)

    print('Using model:', model_path)
    try:
        llm = Llama(model_path=model_path)
        prompt = os.getenv('LLM_TEST_PROMPT', 'You are a helpful assistant. Say hello concisely.')
        resp = llm(prompt, max_tokens=64)
        # llama_cpp returns dict-like; try to print main text
        text = None
        if isinstance(resp, dict):
            # newer versions return {'choices': [{'text': '...'}], ...}
            choices = resp.get('choices') or []
            if choices and isinstance(choices[0], dict):
                text = choices[0].get('text')
        if not text:
            text = str(resp)
        print('--- RESPONSE ---')
        print(text)
    except Exception as e:
        print('Runtime error while loading/generating:', e)
        sys.exit(2)


if __name__ == '__main__':
    main()
