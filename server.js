async function getOllamaReply(contact, history, userMessage) {
  const messages = [
    {
      role: 'system',
      content: `You are neuraCall, a friendly AI phone assistant currently on a live call with ${contact}. Keep replies short and conversational - 1 to 3 sentences maximum.`
    },

    ...history.map((entry) => ({
      role: entry.speaker === 'contact' ? 'user' : 'assistant',
      content: entry.text
    })),

    {
      role: 'user',
      content: userMessage
    }
  ];

  const headers = {
    'Content-Type': 'application/json'
  };

  if (process.env.OLLAMA_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
  }

  console.log('Ollama request:', {
    baseUrl: ollamaBaseUrl,
    model: ollamaModel,
    hasApiKey: Boolean(process.env.OLLAMA_API_KEY)
  });

  const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: ollamaModel,
      messages,
      stream: false
    })
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Ollama responded with ${response.status}: ${responseText}`
    );
  }

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Invalid JSON response from Ollama: ${responseText}`
    );
  }

  return cleanText(data?.message?.content) ||
    'Sorry, could you repeat that?';
}
