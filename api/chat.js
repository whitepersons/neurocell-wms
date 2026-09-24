// api/chat.js
import https from 'node:https';

// Универсальный хелпер для безопасных HTTPS-запросов к серверам Сбера без блокировки по CA Минцифры
function makeHttpsRequest(url, options, data = null) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            rejectUnauthorized: false // КРИТИЧНО: игнорируем ошибку самоподписанного сертификата Минцифры
        };

        const req = https.request(reqOptions, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
                    }
                } catch (e) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    }
                }
            });
        });

        req.on('error', (err) => reject(err));

        if (data) {
            req.write(data);
        }
        req.end();
    });
}

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

        // =========================================================
        // ШАГ 1: Авторизация OAuth2 в Сбере
        // =========================================================
        const rqUid = crypto.randomUUID();
        const tokenData = await makeHttpsRequest(
            'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'RqUID': rqUid,
                    'Authorization': `Basic ${credentials.trim()}`
                }
            },
            `scope=${encodeURIComponent(scope)}`
        );

        const accessToken = tokenData.access_token;

        // =========================================================
        // ШАГ 2: Запрос к модели GigaChat
        // =========================================================
        const systemPrompt = `Ты — оперативный ИИ-диспетчер системы «NeuroCell WMS» (узел NODE-NSK-NC01, Новосибирск).
Контекст: Складской распределительный центр, интеграционный шлюз 1С:WMS, машинное зрение C++/PyTorch.
Текущий инцидент: на камере CAM-03 зафиксирована ошибка адресации — паллета #PL-8492 поставлена в ячейку В-04 вместо ячейки В-06.
Твоя роль: профессионально, емко и строго по делу консультировать оператора, выдавая пошаговые регламенты разрешения коллизий и данные по WMS.`;

        const chatPayload = JSON.stringify({
            model: 'GigaChat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            temperature: 0.3,
            max_tokens: 1024
        });

        const chatData = await makeHttpsRequest(
            'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            },
            chatPayload
        );

        const replyText = chatData.choices[0].message.content;
        return res.status(200).json({ reply: replyText });

    } catch (err) {
        console.error('Ошибка в api/chat:', err);
        return res.status(500).json({ error: err.message });
    }
}