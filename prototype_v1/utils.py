"""Historical provider adapter. Uses a legacy OpenAI client interface."""

import openai


def get_chat_response(model, prompt):
    response = openai.ChatCompletion.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    return response["choices"][0]["message"]["content"]


def get_embedding(text):
    response = openai.Embedding.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response["data"][0]["embedding"]
