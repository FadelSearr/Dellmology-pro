import importlib
spec = importlib.util.find_spec('llama_cpp')
print('llama_cpp available:', bool(spec))
if spec:
    import llama_cpp
    print('llama_cpp version:', getattr(llama_cpp, '__version__', 'unknown'))
