from gpt4all import GPT4All


def main():
    # This will download a small model if not present. It may take a while.
    print('Initializing local GPT4All model (this may download a model)...')
    try:
        model = GPT4All(model_name='ggml-gpt4all-j-v1.3-groovy')
        prompt = 'You are a helpful assistant. Say hello concisely.'
        print('Generating...')
        resp = model.generate(prompt, max_tokens=60)
        print('--- RESPONSE ---')
        print(resp)
    except Exception as e:
        print('ERROR:', e)


if __name__ == '__main__':
    main()
