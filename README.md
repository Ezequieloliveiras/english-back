# English OS Backend

API em `Node.js + Express + TypeScript` para o MVP do English OS.

## Stack

- Express com estrutura `controller/service/repository/model`
- MongoDB com Mongoose
- Dados mockados para o MVP funcionar mesmo sem banco ativo
- OpenAI Responses API no backend com fallback mockado

## Rotas principais

- `GET /api/health`
- `GET /api/content/bootstrap`
- `POST /api/conversations/reply`
- `POST /api/reviews/record`
- `POST /api/onboarding/plan`
- `GET /api/daily-plans/today`
- `PATCH /api/daily-plans/blocks/complete`
- `POST /api/ai/conversation`
- `POST /api/ai/dev-mode`
- `POST /api/ai/think-in-english`
- `POST /api/ai/vocabulary`
- `POST /api/ai/daily-plan`
- `POST /api/ai/analyze-mistake`

## Como rodar

```bash
npm install
cp .env.example .env
npm run dev
```

Servidor padrao: `http://localhost:4000`

## OpenAI

A chave da OpenAI deve ficar somente no backend:

```bash
OPENAI_API_KEY=coloque_a_chave_aqui
```

As rotas `/api/ai/*` usam a Responses API para gerar respostas de coach de ingles. Se a chave nao estiver configurada, ou se a OpenAI falhar, a API retorna fallback mockado sem expor stack trace ao frontend.

## Observacoes

- Se o MongoDB nao estiver disponivel, a API sobe com repositorio mockado.
- Os schemas de `User`, `DailyPlan`, `StudyBlock`, `VocabularyItem`, `ReviewSchedule`, `ConversationSession`, `StudentMistake`, `Progress` e `UserGoal` ja estao preparados para evolucao.
# english-back
