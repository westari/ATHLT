const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { drills, focus, dayNumber, totalDays } = req.body || {};

  if (!Array.isArray(drills) || drills.length === 0) {
    return res.status(400).json({ error: 'drills required' });
  }

  const drillList = drills
    .map((d, i) => `${i + 1}. ${d.name} (${d.time}${d.category ? ', ' + d.category : ''})`)
    .join('\n');

  const prompt = `You are Coach X, a real HS/AAU basketball trainer. Direct, honest, no hype, no fluff.

A player just finished their session. Day ${dayNumber || 1} of ${totalDays || 7}. Focus: ${focus || 'general training'}.

Drills completed:
${drillList}

Give a post-session read in 2-3 sentences max. Reference the drills by name. Name one specific thing they built today and one thing to sharpen next session. No "great job", no "keep grinding", no motivational filler. Coach voice only.`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (msg.content[0]?.text || '').trim();
    return res.status(200).json({ message: text });
  } catch (err) {
    console.error('[coach-postgame] error:', err);
    return res.status(500).json({ error: 'Failed to get Coach X read' });
  }
};
