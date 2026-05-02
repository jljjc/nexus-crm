# NexusCRM Omnichannel Webhook Guide (Make / n8n)

This guide explains how to connect your WeChat and WhatsApp Business accounts to NexusCRM using Make (Integromat) or n8n.

## 1. Supabase Database Setup

Before sending messages, ensure the `messages` table exists in your Supabase database. Run this SQL in the Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS messages (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  channel      TEXT NOT NULL DEFAULT 'other',
  external_id  TEXT,
  sender_name  TEXT,
  sender_id    TEXT,
  content      TEXT NOT NULL,
  direction    TEXT NOT NULL DEFAULT 'inbound',
  status       TEXT NOT NULL DEFAULT 'unread',
  ai_draft     TEXT,
  needs_review BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON messages FOR ALL USING (true) WITH CHECK (true);
```

## 2. Inbound Webhook (Make/n8n → NexusCRM)

When a client sends a message on WeChat or WhatsApp, your automation tool should forward it to NexusCRM.

**Endpoint:** `POST https://<your-netlify-domain>/api/webhook-messages`

**Headers:**
- `Content-Type: application/json`
- `x-webhook-secret: <your-secret>` (Optional, if configured in Netlify environment variables)

**JSON Body:**
```json
{
  "channel": "wechat",
  "external_id": "msg_123456789",
  "sender_name": "Alex Taylor",
  "sender_id": "wxid_alextaylor123",
  "content": "Hi, what is the status of my 186 visa application?",
  "timestamp": "2026-05-02T10:30:00Z"
}
```

### Field Definitions:
- `channel`: Must be `wechat`, `whatsapp`, `sms`, or `email`.
- `external_id`: The unique message ID from the platform (used to prevent duplicates).
- `sender_name`: The display name of the sender.
- `sender_id`: The WeChat ID or WhatsApp phone number (used to match with existing clients in NexusCRM).
- `content`: The actual text message.

### What happens next?
1. NexusCRM tries to match the `sender_id` or `sender_name` to an existing client.
2. Claude AI reads the message and the client's profile.
3. Claude drafts a reply (in the same language).
4. The message appears in the **Omnichannel Inbox** in NexusCRM with the status `AI草稿待审` (AI Draft Ready).

## 3. Outbound Webhook (NexusCRM → Make/n8n) [Optional]

Currently, when staff click "Approve & Send" in NexusCRM, the message status is updated to `sent` in the database. 

To actually send the message back to the client via WeChat/WhatsApp, you have two options:

### Option A: Polling (Easier)
Set up a Make/n8n scenario that runs every 1 minute:
1. Query Supabase: `GET /rest/v1/messages?status=eq.sent&direction=eq.outbound&is_delivered=is.null`
2. For each message, send it via the respective channel API.
3. Update the message in Supabase to mark it as delivered.

### Option B: Webhook (Real-time)
Modify `src/Inbox.jsx` (around line 220) to trigger a webhook in Make/n8n when a message is approved:

```javascript
// Example code to add to handleApprove()
await fetch('https://hook.make.com/your-webhook-id', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    channel: msg.channel,
    recipient_id: msg.sender_id,
    content: draftText
  })
});
```

## 4. Testing

You can test the integration directly from the NexusCRM Inbox UI by clicking the **"🧪 发送测试消息" (Send Test Message)** button. This will simulate an inbound WeChat message and trigger the AI drafting process.
