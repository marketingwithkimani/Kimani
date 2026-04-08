# Add Webhook Directive

## Goal
Register a new Modal webhook that maps to a directive, enabling event-driven execution.

## Process

### 1. Create the Directive
- Write a new directive in `directives/` describing what the webhook should do
- Include: goal, inputs (webhook payload), tools to use, expected output, edge cases

### 2. Register in webhooks.json
- Add an entry to `execution/webhooks.json`:
  ```json
  {
    "webhooks": {
      "your-slug": {
        "directive": "directives/your_directive.md",
        "description": "Short description of what this webhook does"
      }
    }
  }
  ```

### 3. Deploy
```bash
modal deploy execution/modal_webhook.py
```

### 4. Test
- Hit the endpoint: `https://nick-90891--claude-orchestrator-directive.modal.run?slug=your-slug`
- Verify Slack notification arrives
- Verify the directive executes correctly

## Available Tools for Webhooks
- `send_email` — Send emails
- `read_sheet` — Read from Google Sheets
- `update_sheet` — Update Google Sheets

## Endpoints
- **List webhooks**: `https://nick-90891--claude-orchestrator-list-webhooks.modal.run`
- **Execute directive**: `https://nick-90891--claude-orchestrator-directive.modal.run?slug={slug}`
- **Test email**: `https://nick-90891--claude-orchestrator-test-email.modal.run`

## Edge Cases
- Always validate the slug exists in `webhooks.json` before deploying
- Webhook payloads should be validated with Zod schemas
- All webhook activity streams to Slack in real-time
