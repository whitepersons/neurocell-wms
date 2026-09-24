// api/chat.js
import https from 'node:https';

// Игнорируем проверку сертификата Минцифры Сбера
const agent = new https.Agent({
    rejectUnauthorized: false
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { message } = req.body || {};

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Поле message не может быть пустым' });
        }

        const credentials = process.env.GIGACHAT_CREDENTIALS;
        const scope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS';

        if (!credentials) {
            return res.status(500).json({ error: 'В Vercel не задана переменная GIGACHAT_CREDENTIALS' });
        }

        // ШАГ 1: Авторизация OAuth2
        const rqUid = crypto.randomUUID();
        const tokenRes = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'RqUID': rqUid,
                'Authorization': `Basic ${credentials.trim()}`
            },
            body: `scope=${encodeURIComponent(scope)}`,
            agent: agent
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.text();
            throw new Error(`Ошибка авторизации Сбера (${tokenRes.status}): ${err}`);
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // ШАГ 2: Запрос к GigaChat с контекстом NeuroCell WMS
        const systemPrompt = `Ты — оперативный ИИ-диспетчер системы «NeuroCell WMS» (узел NODE-NSK-NC01, Новосибирск).
Контекст: Складской распределительный центр, интеграционный шлюз 1С:WMS, машинное зрение C++/PyTorch.
Текущий инцидент: на камере CAM-03 зафиксирована ошибка адресации — паллета #PL-8492 поставлена в ячейку В-04 вместо ячейки В-06.
Твоя роль: профессионально, емко и строго по делу консультировать оператора, выдавая пошаговые регламенты разрешения коллизий и данные по WMS.`;

        const chatRes = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                model: 'GigaChat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                temperature: 0.3,
                max_tokens: 1024
            }),
            agent: agent
        });

        if (!chatRes.ok) {
            const chatErr = await chatRes.text();
            throw new Error(`Ошибка генерации GigaChat (${chatRes.status}): ${chatErr}`);
        }

        const chatData = await chatRes.json();
        const replyText = chatData.choices[0].message.content;

        return res.status(200).json({ reply: replyText });

    } catch (err) {
        console.error('Ошибка в api/chat:', err);
        return res.status(500).json({ error: err.message });
    }
}