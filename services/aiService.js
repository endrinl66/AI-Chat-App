const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const getGroqSummary = async (conversationText) => {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content: 'Summarize this group chat conversation in 2-3 short sentences, using proper capitalization and grammar. Be concise and focus on key points or decisions made. No preamble, just the summary.',
      },
      {
        role: 'user',
        content: conversationText,
      },
    ],
  });
  return response.choices[0].message.content;
};

const getGroqSuggestions = async (conversationText) => {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 150,
    messages: [
      {
        role: 'system',
        content: 'You suggest 3 short, natural reply options for a group chat, based on the conversation. Each reply should be under 8 words, with proper capitalization and grammar. Return ONLY the 3 replies, one per line, no numbering, no quotes, no extra text.',
      },
      {
        role: 'user',
        content: `Conversation:\n\n${conversationText}\n\nSuggest 3 short replies to the last message.`,
      },
    ],
  });

  const text = response.choices[0].message.content;
  return text.split('\n').map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 3);
};

const getAIReply = async (recentMessages) => {
  const conversationText = recentMessages
    .map((m) => `${m.senderName}: ${m.content}`)
    .join('\n');

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: 'You are a helpful, friendly assistant participating in a group chat. Keep replies short and conversational, like a real chat message. Do not use markdown formatting. Always use proper capitalization and grammar, including capitalizing the first word of sentences and proper nouns like names and places.',
      },
      {
        role: 'user',
        content: `Here is the recent conversation:\n\n${conversationText}\n\nRespond naturally to the last message as the AI assistant.`,
      },
    ],
  });

  return response.choices[0].message.content;
};

module.exports = { getAIReply, getGroqSuggestions, getGroqSummary };