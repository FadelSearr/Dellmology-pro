from dellmology.intelligence.ai_narrative import generate_narrative

payload = {
    'stats': {
        'timestamp': '2026-03-11T00:00:00Z',
        'avg_score': 80.5,
        'bullish_count': 5,
        'bearish_count': 1,
        'kill_switch_triggered': False,
    },
    'top_pick': {'symbol': 'BBCA', 'score': 92.3},
    'results': []
}

text = generate_narrative(payload, symbol='BBCA', use_llm=False)
print(text)
# Basic assertion
if 'Top pick' not in text or 'Average score' not in text:
    raise SystemExit(2)
print('OK')
