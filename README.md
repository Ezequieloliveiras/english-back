# English OS Backend

API em `Node.js + Express + TypeScript` para o MVP do English OS.

## Stack

- Express com estrutura `controller/service/repository/model`
- MongoDB com Mongoose
- Autenticacao JWT em cookie `httpOnly` com rotas protegidas
- Helmet e rate limit para protecao HTTP basica
- Catalogo inicial semeado no MongoDB na primeira execucao
- OpenAI Responses API no backend sem expor chave no frontend

## Rotas principais

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/audio/providers`
- `POST /api/audio/speech`
- `GET /api/content/bootstrap`
- `POST /api/conversations/reply`
- `POST /api/reviews/record`
- `POST /api/profile/plan`
- `GET /api/daily-plans/today`
- `PATCH /api/daily-plans/blocks/complete`
- `POST /api/ai/conversation`
- `POST /api/ai/dev-mode`
- `POST /api/ai/think-in-english`
- `POST /api/ai/vocabulary`
- `POST /api/ai/daily-plan`
- `POST /api/ai/analyze-mistake`
- `POST /api/practice/complete`

## Como rodar

```bash
npm install
cp .env.example .env
npm run dev
```

Servidor padrao: `http://localhost:4000`

## Testes

```bash
npm test
```

Os testes cobrem cadastro/login com cookie `httpOnly`, rota protegida sem sessao, logout e headers de seguranca.

## OpenAI

A chave da OpenAI deve ficar somente no backend:

```bash
OPENAI_API_KEY=coloque_a_chave_aqui
```

As rotas `/api/ai/*` usam a Responses API para gerar respostas de coach de ingles. Se a chave nao estiver configurada, ou se a OpenAI falhar, a API retorna erro seguro sem expor stack trace ao frontend.

## Audio

O audio do app usa voz gerada no backend:

- `openai`: usa `OPENAI_API_KEY` e retorna MP3 gerado por OpenAI.
- `google` ou `custom`: usam `VOICE_PROVIDER_ENDPOINT` e `VOICE_PROVIDER_API_KEY` para integrar um gateway externo.

```bash
VOICE_PROVIDER_ENDPOINT=
VOICE_PROVIDER_API_KEY=
```

## Observacoes

- MongoDB e necessario para as funcionalidades reais de usuario, progresso, revisao e historico.
- Os schemas de `User`, `DailyPlan`, `StudyBlock`, `VocabularyItem`, `ReviewSchedule`, `ConversationSession`, `StudentMistake`, `PracticeActivity`, `Progress` e `UserGoal` ja estao preparados para evolucao.
