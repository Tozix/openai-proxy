# OpenAI API Proxy

Прозрачный прокси к OpenAI API с защитой по префиксу токена. Совместим с клиентами OpenAI (Python, Node и др.): укажите `base_url` на этот сервер и передавайте токен в формате `PROXY_PREFIX:sk-your-openai-key`.

## Запуск

```bash
cp .env.example .env
# Отредактируйте .env: задайте PROXY_AUTH_PREFIX
npm install
npm run start
```

По умолчанию сервер слушает порт 3000. Все запросы к `/v1` и `/v1/*` проксируются на `https://api.openai.com/v1/*`.

## Docker

Nginx — на хост-машине. В `docker-compose` задан **network_mode: host**: приложение слушает порт **7388** на хосте, исходящие запросы к OpenAI идут с хоста (с его IP и сети).

```bash
cp .env.example .env
# Отредактируйте .env (PORT=7388 уже задан в compose)
docker compose up -d --build
```

Прокси доступен на `http://localhost:7388/v1` (или за nginx на вашем домене).

## Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `PORT` | Порт сервера | 3000 |
| `OPENAI_BASE_URL` | Базовый URL OpenAI | https://api.openai.com |
| `PROXY_AUTH_PREFIX` | Обязательный префикс в токене | (пусто — только для dev) |

Клиент должен отправлять: `Authorization: Bearer <PROXY_AUTH_PREFIX>:<OPENAI_API_KEY>`.

## Тест (Python)

См. папку `client-test/`: скрипт `test_proxy.py` и инструкции в начале файла.

```bash
cd client-test
pip install -r requirements.txt
export PROXY_BASE_URL=http://localhost:3000/v1
export PROXY_AUTH_PREFIX=myproxy
export OPENAI_API_KEY=sk-your-key
python test_proxy.py
```
