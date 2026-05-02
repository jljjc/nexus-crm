// src/Inbox.jsx
// Phase 3: Omnichannel Communication Sync
// Displays WeChat/WhatsApp messages, AI-drafted replies, and staff approval workflow.
//
// Data flow:
//   Make/n8n → POST /api/webhook-messages → Supabase `messages` table
//   Inbox UI → GET /api/webhook-messages → display conversations
//   Staff approves → PATCH /api/webhook-messages → status='approved'
//   (Optional) Netlify function → send reply back via Make/n8n

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────
const SB_URL = process.env.REACT_APP_SB_URL;
const SB_KEY = process.env.REACT_APP_SB_KEY;

const CHANNEL_META = {
  wechat:    { icon: '💬', label: 'WeChat',    color: '#07C160', bg: '#E8F9EE' },
  whatsapp:  { icon: '📱', label: 'WhatsApp',  color: '#25D366', bg: '#E8F9EE' },
  sms:       { icon: '📨', label: 'SMS',       color: '#3B82F6', bg: '#EFF6FF' },
  email:     { icon: '📧', label: 'Email',     color: '#6366F1', bg: '#EEF2FF' },
  other:     { icon: '💭', label: 'Other',     color: '#94A3B8', bg: '#F1F5F9' },
};

const STATUS_META = {
  unread:       { label: '未读',     color: '#EF4444', bg: '#FEF2F2' },
  draft_ready:  { label: 'AI草稿',   color: '#F59E0B', bg: '#FFFBEB' },
  approved:     { label: '已批准',   color: '#10B981', bg: '#ECFDF5' },
  sent:         { label: '已发送',   color: '#6366F1', bg: '#EEF2FF' },
};

// ── Supabase direct helpers ──────────────────────────────────────────────────
const sbFetch = async (path, method = 'GET', body = null) => {
  const headers = {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
  };
  if (method === 'POST') headers['Prefer'] = 'return=representation';
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, opts);
  if (!res.ok) throw new Error(`DB error: ${res.status}`);
  if (method === 'DELETE' || res.status === 204) return null;
  return res.json();
};

// ── Utilities ────────────────────────────────────────────────────────────────
const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return d.toLocaleDateString('en-AU', { weekday: 'short' });
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

const fmtDateTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

// ── Sub-components ───────────────────────────────────────────────────────────

function ChannelBadge({ channel, small }) {
  const meta = CHANNEL_META[channel] || CHANNEL_META.other;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: meta.bg, color: meta.color,
      borderRadius: 99, padding: small ? '2px 7px' : '3px 9px',
      fontSize: small ? 10 : 11, fontWeight: 600,
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

// eslint-disable-next-line no-unused-vars
function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.unread;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: meta.bg, color: meta.color,
      borderRadius: 99, padding: '2px 8px',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
    }}>
      {meta.label}
    </span>
  );
}

// Conversation list item in the sidebar
function ConvItem({ conv, isActive, onClick }) {
  const lastMsg = conv.messages?.[conv.messages.length - 1];
  const unreadCount = conv.messages?.filter(m => m.status === 'unread' || m.status === 'draft_ready').length || 0;
  const meta = CHANNEL_META[conv.channel] || CHANNEL_META.other;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9',
        background: isActive ? '#FDF0F8' : '#fff',
        borderLeft: isActive ? '3px solid #E91E8C' : '3px solid transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 99,
            background: `linear-gradient(135deg, ${meta.color}30, ${meta.color}60)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>
            {meta.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {conv.clientName || conv.senderName || 'Unknown'}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
              {lastMsg?.content?.slice(0, 50) || 'No messages'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>{fmtTime(lastMsg?.created_at)}</div>
          {unreadCount > 0 && (
            <div style={{
              background: '#E91E8C', color: '#fff', borderRadius: 99,
              fontSize: 9, fontWeight: 700, padding: '1px 6px', minWidth: 16, textAlign: 'center',
            }}>
              {unreadCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Individual message bubble
function MessageBubble({ msg, isOutbound }) {
  const meta = CHANNEL_META[msg.channel] || CHANNEL_META.other;
  return (
    <div style={{
      display: 'flex', justifyContent: isOutbound ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      <div style={{
        maxWidth: '72%',
        background: isOutbound ? 'linear-gradient(135deg, #E91E8C, #FF6EC7)' : '#F1F5F9',
        color: isOutbound ? '#fff' : '#111827',
        borderRadius: isOutbound ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        padding: '10px 14px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        {!isOutbound && (
          <div style={{ fontSize: 10, fontWeight: 600, color: meta.color, marginBottom: 4 }}>
            {meta.icon} {msg.sender_name || 'Client'} · {meta.label}
          </div>
        )}
        <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {msg.content}
        </div>
        <div style={{
          fontSize: 10, marginTop: 4, textAlign: 'right',
          color: isOutbound ? 'rgba(255,255,255,0.7)' : '#9CA3AF',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6,
        }}>
          {fmtDateTime(msg.created_at)}
          {msg.status === 'sent' && <span>✓✓</span>}
          {msg.status === 'approved' && <span>✓</span>}
        </div>
      </div>
    </div>
  );
}

// AI Draft approval panel
function DraftPanel({ msg, onApprove, onEdit, onDiscard, loading }) {
  const [editMode, setEditMode] = useState(false);
  const [draftText, setDraftText] = useState(msg.ai_draft || '');
  const needsReview = draftText.startsWith('[NEEDS STAFF REVIEW]');
  const cleanDraft = draftText.replace('[NEEDS STAFF REVIEW]', '').trim();

  return (
    <div style={{
      background: '#FFFBEB', border: '1.5px solid #F59E0B', borderRadius: 12,
      padding: '14px 16px', margin: '12px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>🤖</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#92400E' }}>AI 草稿回复</span>
        {needsReview && (
          <span style={{ background: '#FEF2F2', color: '#EF4444', borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
            ⚠️ 需要人工审核
          </span>
        )}
      </div>

      {editMode ? (
        <textarea
          value={editMode ? draftText : cleanDraft}
          onChange={e => setDraftText(e.target.value)}
          style={{
            width: '100%', minHeight: 100, padding: '10px 12px',
            border: '1.5px solid #F59E0B', borderRadius: 8,
            fontSize: 13, lineHeight: 1.5, resize: 'vertical',
            background: '#fff', outline: 'none', fontFamily: 'inherit',
          }}
        />
      ) : (
        <div style={{
          background: '#fff', borderRadius: 8, padding: '10px 12px',
          fontSize: 13, lineHeight: 1.6, color: '#374151',
          border: '1px solid #FDE68A', whiteSpace: 'pre-wrap',
        }}>
          {cleanDraft || '（草稿为空）'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {editMode ? (
          <>
            <button
              onClick={() => { onEdit(draftText); setEditMode(false); }}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #E91E8C, #FF6EC7)', color: '#fff',
                border: 'none', borderRadius: 8, padding: '8px 16px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              ✓ 保存并批准
            </button>
            <button
              onClick={() => { setDraftText(msg.ai_draft || ''); setEditMode(false); }}
              style={{
                background: '#F1F5F9', color: '#374151',
                border: 'none', borderRadius: 8, padding: '8px 14px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              取消
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onApprove(draftText)}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #10B981, #34D399)', color: '#fff',
                border: 'none', borderRadius: 8, padding: '8px 16px',
                fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '处理中...' : '✓ 批准并发送'}
            </button>
            <button
              onClick={() => setEditMode(true)}
              style={{
                background: '#FEF3C7', color: '#92400E',
                border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 14px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              ✏️ 编辑草稿
            </button>
            <button
              onClick={onDiscard}
              style={{
                background: '#FEF2F2', color: '#EF4444',
                border: '1px solid #FECACA', borderRadius: 8, padding: '8px 14px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              ✕ 丢弃
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Inbox Component ─────────────────────────────────────────────────────
export default function Inbox({ clients, messages: propMessages, setMessages: setPropMessages }) {
  const [localMessages, setLocalMessages] = useState([]);
  // Use prop messages if provided (from App.js global state), otherwise use local state
  const messages = propMessages !== undefined ? propMessages : localMessages;
  const setMessages = setPropMessages !== undefined ? setPropMessages : setLocalMessages;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedConvKey, setSelectedConvKey] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'draft_ready'
  const [searchQ, setSearchQ] = useState('');
  // testMode reserved for future use
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  // ── Load messages from Supabase ──────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    try {
      const rows = await sbFetch('messages?select=*&order=created_at.asc&limit=500');
      setMessages(rows || []);
      setError(null);
    } catch (e) {
      setError('无法加载消息: ' + e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMessages();
    // Poll every 30 seconds for new messages
    pollRef.current = setInterval(loadMessages, 30000);
    return () => clearInterval(pollRef.current);
  }, [loadMessages]);

  // Scroll to bottom when conversation changes or messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConvKey, messages.length]);

  // ── Group messages into conversations ────────────────────────────────────
  // Group by (client_id OR sender_id) + channel
  const conversations = React.useMemo(() => {
    const convMap = {};
    for (const msg of messages) {
      const key = `${msg.client_id || msg.sender_id || 'unknown'}_${msg.channel || 'other'}`;
      if (!convMap[key]) {
        // Find client name
        const client = clients?.find(c => c.id === msg.client_id);
        convMap[key] = {
          key,
          clientId: msg.client_id,
          clientName: client?.name || null,
          senderName: msg.sender_name,
          channel: msg.channel,
          messages: [],
        };
      }
      convMap[key].messages.push(msg);
    }
    // Sort conversations by latest message
    return Object.values(convMap).sort((a, b) => {
      const aLast = a.messages[a.messages.length - 1]?.created_at || '';
      const bLast = b.messages[b.messages.length - 1]?.created_at || '';
      return bLast.localeCompare(aLast);
    });
  }, [messages, clients]);

  // ── Filter conversations ─────────────────────────────────────────────────
  const filteredConvs = React.useMemo(() => {
    return conversations.filter(conv => {
      if (filter === 'unread' && !conv.messages.some(m => m.status === 'unread')) return false;
      if (filter === 'draft_ready' && !conv.messages.some(m => m.status === 'draft_ready')) return false;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        const nameMatch = (conv.clientName || conv.senderName || '').toLowerCase().includes(q);
        const msgMatch = conv.messages.some(m => m.content?.toLowerCase().includes(q));
        if (!nameMatch && !msgMatch) return false;
      }
      return true;
    });
  }, [conversations, filter, searchQ]);

  const selectedConv = filteredConvs.find(c => c.key === selectedConvKey) || filteredConvs[0];

  // ── Update message status in Supabase ────────────────────────────────────
  const updateMessage = async (id, updates) => {
    await sbFetch(`messages?id=eq.${id}`, 'PATCH', updates);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  // ── Approve draft ────────────────────────────────────────────────────────
  const handleApprove = async (msg, draftText) => {
    setActionLoading(true);
    try {
      // Update the draft text if edited, then mark as approved
      await updateMessage(msg.id, {
        ai_draft: draftText,
        status: 'approved',
      });

      // Insert the outbound message into the conversation
      const outboundMsg = {
        client_id: msg.client_id,
        channel: msg.channel,
        external_id: null,
        sender_name: 'Ozsky Staff',
        sender_id: 'ozsky',
        content: draftText.replace('[NEEDS STAFF REVIEW]', '').trim(),
        direction: 'outbound',
        status: 'sent',
        ai_draft: null,
        needs_review: false,
        created_at: new Date().toISOString(),
      };
      const inserted = await sbFetch('messages', 'POST', outboundMsg);
      const newMsg = inserted?.[0] || inserted;
      if (newMsg) setMessages(prev => [...prev, newMsg]);

      // TODO: Trigger Make/n8n webhook to actually send the message
      // await fetch('/api/send-reply', { method: 'POST', body: JSON.stringify({ channel: msg.channel, ... }) });
    } catch (e) {
      alert('操作失败: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Discard draft ────────────────────────────────────────────────────────
  const handleDiscard = async (msg) => {
    if (!window.confirm('确认丢弃此 AI 草稿？')) return;
    await updateMessage(msg.id, { status: 'unread', ai_draft: null });
  };

  // ── Send manual reply ────────────────────────────────────────────────────
  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConv) return;
    setActionLoading(true);
    try {
      const outboundMsg = {
        client_id: selectedConv.clientId,
        channel: selectedConv.channel,
        external_id: null,
        sender_name: 'Ozsky Staff',
        sender_id: 'ozsky',
        content: replyText.trim(),
        direction: 'outbound',
        status: 'sent',
        ai_draft: null,
        needs_review: false,
        created_at: new Date().toISOString(),
      };
      const inserted = await sbFetch('messages', 'POST', outboundMsg);
      const newMsg = inserted?.[0] || inserted;
      if (newMsg) setMessages(prev => [...prev, newMsg]);
      setReplyText('');
    } catch (e) {
      alert('发送失败: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Send test message ────────────────────────────────────────────────────
  const handleTestMessage = async () => {
    const testPayload = {
      channel: 'wechat',
      external_id: `test_${Date.now()}`,
      sender_name: '测试客户 Test Client',
      sender_id: '+61400000000',
      content: '你好，我想了解一下我的签证申请进度，大概还需要多久？',
      secret: '', // No secret in test mode
    };
    try {
      const res = await fetch('/api/webhook-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });
      const data = await res.json();
      if (data.ok) {
        await loadMessages();
        alert(`✓ 测试消息已发送！\n客户匹配: ${data.clientMatched ? data.clientName : '未匹配'}\nAI草稿: ${data.draftGenerated ? '已生成' : '未生成'}`);
      } else {
        alert('发送失败: ' + JSON.stringify(data));
      }
    } catch (e) {
      alert('测试失败: ' + e.message);
    }
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalUnread = messages.filter(m => m.status === 'unread' || m.status === 'draft_ready').length;
  const totalDrafts = messages.filter(m => m.status === 'draft_ready').length;

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12 }}>
        <div style={{ width: 24, height: 24, border: '3px solid #E91E8C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#6B7280', fontSize: 14 }}>加载消息中...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', gap: 0 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>
            💬 全渠道收件箱
          </h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
            WeChat · WhatsApp · SMS — AI 辅助回复 + 员工审核
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {totalUnread > 0 && (
            <span style={{ background: '#FEF2F2', color: '#EF4444', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
              {totalUnread} 条未处理
            </span>
          )}
          {totalDrafts > 0 && (
            <span style={{ background: '#FFFBEB', color: '#F59E0B', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
              {totalDrafts} 个 AI 草稿待审
            </span>
          )}
          <button
            onClick={loadMessages}
            style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' }}
          >
            🔄 刷新
          </button>
          <button
            onClick={handleTestMessage}
            style={{ background: '#EEF2FF', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#6366F1' }}
          >
            🧪 发送测试消息
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#DC2626', fontSize: 13 }}>
          ⚠️ {error}
          <span style={{ marginLeft: 8, color: '#6B7280', fontSize: 11 }}>
            （请确认 Supabase 中已创建 `messages` 表 — 见下方设置指南）
          </span>
        </div>
      )}

      {/* ── Main Layout: Sidebar + Chat ── */}
      <div style={{ display: 'flex', flex: 1, gap: 0, background: '#fff', borderRadius: 14, border: '1.5px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>

        {/* ── Left Sidebar: Conversation List ── */}
        <div style={{ width: 280, borderRight: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Search & Filter */}
          <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #F1F5F9' }}>
            <input
              type="text"
              placeholder="搜索客户或消息..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1.5px solid #E5E7EB', fontSize: 12, outline: 'none',
                background: '#F9FAFB', marginBottom: 8,
              }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              {[['all', '全部'], ['unread', '未读'], ['draft_ready', 'AI草稿']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilter(val)}
                  style={{
                    flex: 1, padding: '5px 0', border: 'none', borderRadius: 6, fontSize: 10,
                    fontWeight: 600, cursor: 'pointer',
                    background: filter === val ? '#E91E8C' : '#F1F5F9',
                    color: filter === val ? '#fff' : '#6B7280',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredConvs.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>暂无消息</div>
                <div style={{ fontSize: 11 }}>
                  {filter !== 'all' ? '切换到"全部"查看所有消息' : '点击"发送测试消息"体验功能'}
                </div>
              </div>
            ) : (
              filteredConvs.map(conv => (
                <ConvItem
                  key={conv.key}
                  conv={conv}
                  isActive={conv.key === (selectedConv?.key)}
                  onClick={() => setSelectedConvKey(conv.key)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right: Chat Window ── */}
        {selectedConv ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Chat header */}
            <div style={{
              padding: '14px 18px', borderBottom: '1px solid #F1F5F9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#FAFAFA',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 99, background: 'linear-gradient(135deg, #E91E8C30, #E91E8C60)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {CHANNEL_META[selectedConv.channel]?.icon || '💬'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                    {selectedConv.clientName || selectedConv.senderName || 'Unknown'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                    <ChannelBadge channel={selectedConv.channel} small />
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {selectedConv.messages.length} 条消息
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {selectedConv.clientId && (
                  <span style={{ fontSize: 11, color: '#6B7280', background: '#F1F5F9', borderRadius: 6, padding: '4px 10px' }}>
                    ✓ 已关联客户
                  </span>
                )}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
              {selectedConv.messages.map(msg => {
                const isOutbound = msg.direction === 'outbound';
                return (
                  <div key={msg.id}>
                    <MessageBubble msg={msg} isOutbound={isOutbound} />
                    {/* Show AI draft panel for inbound messages with draft_ready status */}
                    {!isOutbound && msg.status === 'draft_ready' && msg.ai_draft && (
                      <DraftPanel
                        msg={msg}
                        loading={actionLoading}
                        onApprove={(text) => handleApprove(msg, text)}
                        onEdit={(text) => updateMessage(msg.id, { ai_draft: text })}
                        onDiscard={() => handleDiscard(msg)}
                      />
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9', background: '#FAFAFA' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSendReply(); }}
                  placeholder="输入回复... (⌘+Enter 发送)"
                  rows={2}
                  style={{
                    flex: 1, padding: '10px 12px', border: '1.5px solid #E5E7EB',
                    borderRadius: 10, fontSize: 13, resize: 'none', outline: 'none',
                    fontFamily: 'inherit', lineHeight: 1.5,
                  }}
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || actionLoading}
                  style={{
                    background: replyText.trim() ? 'linear-gradient(135deg, #E91E8C, #FF6EC7)' : '#E5E7EB',
                    color: replyText.trim() ? '#fff' : '#9CA3AF',
                    border: 'none', borderRadius: 10, padding: '10px 16px',
                    fontSize: 13, fontWeight: 700, cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                  }}
                >
                  发送
                </button>
              </div>
              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6 }}>
                💡 回复将记录在 NexusCRM 中。如需实际发送到 WeChat/WhatsApp，请配置 Make/n8n 发送 webhook。
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#9CA3AF' }}>
            <div style={{ fontSize: 48 }}>💬</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>选择一个对话</div>
            <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 280 }}>
              从左侧选择一个客户对话，或点击"发送测试消息"体验 AI 草稿功能
            </div>
          </div>
        )}
      </div>

      {/* ── Setup Guide ── */}
      <div style={{ marginTop: 16, background: '#F8FAFC', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 10 }}>
          🔧 设置指南
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <SetupStep
            num="1"
            title="创建 Supabase 表"
            desc="在 Supabase SQL Editor 中运行建表 SQL（见下方）"
            status="required"
          />
          <SetupStep
            num="2"
            title="配置 Make/n8n"
            desc="将 WeChat/WhatsApp 消息转发到 POST /api/webhook-messages"
            status="required"
          />
          <SetupStep
            num="3"
            title="设置 Webhook Secret"
            desc="在 Netlify 环境变量中设置 WEBHOOK_SECRET"
            status="recommended"
          />
          <SetupStep
            num="4"
            title="配置发送回调（可选）"
            desc="在 Make/n8n 中监听 /api/send-reply 以实际发送消息"
            status="optional"
          />
        </div>

        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#6366F1' }}>
            📋 查看 Supabase 建表 SQL
          </summary>
          <pre style={{
            marginTop: 8, background: '#1E2035', color: '#E2E8F0',
            borderRadius: 8, padding: '12px 14px', fontSize: 11,
            overflowX: 'auto', lineHeight: 1.6,
          }}>
{`CREATE TABLE IF NOT EXISTS messages (
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

-- Index for fast client lookups
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust as needed)
CREATE POLICY "Allow all for authenticated" ON messages
  FOR ALL USING (true) WITH CHECK (true);`}
          </pre>
        </details>
      </div>
    </div>
  );
}

function SetupStep({ num, title, desc, status }) {
  const colors = {
    required:    { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', badge: '必须' },
    recommended: { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706', badge: '建议' },
    optional:    { bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A', badge: '可选' },
  };
  const c = colors[status] || colors.optional;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ width: 20, height: 20, borderRadius: 99, background: c.text, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
          {num}
        </div>
        <span style={{ fontWeight: 700, fontSize: 12, color: '#111827' }}>{title}</span>
        <span style={{ background: c.text, color: '#fff', borderRadius: 99, padding: '1px 6px', fontSize: 9, fontWeight: 700, marginLeft: 'auto' }}>
          {c.badge}
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', paddingLeft: 28 }}>{desc}</div>
    </div>
  );
}
