'use client';

import React, { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { toast } from 'react-hot-toast';

// Suggested prompts per role
const SUGGESTED_PROMPTS = {
  student: [
    '📊 Show my attendance summary',
    '💳 Check fee dues & scholarship status',
    '🎓 Am I eligible for semester exams?',
    '⚡ What is my academic risk score?'
  ],
  faculty: [
    '📈 Show my topic completion rate',
    '📝 Attendance submission history',
    '⚠️ Which students have low attendance?',
    '📊 Class performance overview'
  ],
  hod: [
    '🏢 Show department performance summary',
    '👨‍🏫 Faculty workload distribution',
    '📊 Subject pass percentage breakdown',
    '🚨 Critical student risk breakdown'
  ],
  admin: [
    '🏛️ Show institution KPIs & dept comparison',
    '💾 Archive growth & system health status',
    '💳 Fee defaulters & pending approvals',
    '🛡️ Governance & institutional compliance'
  ]
};

const ROLE_TITLES = {
  student: { title: 'Student Intelligence Assistant', badge: 'STUDENT PORTAL', color: 'from-blue-600 to-indigo-700' },
  faculty: { title: 'Faculty Academic Assistant', badge: 'FACULTY CONSOLE', color: 'from-teal-600 to-cyan-700' },
  hod: { title: 'HOD Executive Assistant', badge: 'HOD DESK', color: 'from-indigo-600 to-purple-700' },
  admin: { title: 'Super Admin Command Assistant', badge: 'ADMIN CORE', color: 'from-[#0b3578] to-slate-900' }
};

export default function AssistantContainer({ role = 'student', isDrawerMode = false, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingConvId, setEditingConvId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showHistorySidebar, setShowHistorySidebar] = useState(!isDrawerMode);
  const [showExplainabilityMap, setShowExplainabilityMap] = useState({});
  const [, startTransition] = useTransition();

  const messagesEndRef = useRef(null);

  const roleMeta = ROLE_TITLES[role] || ROLE_TITLES.student;
  const promptList = SUGGESTED_PROMPTS[role] || SUGGESTED_PROMPTS.student;

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        if (data.conversations && data.conversations.length > 0 && !activeConvId) {
          setActiveConvId(data.conversations[0].id);
        }
      }
    } catch (_err) {
      toast.error('Failed to load chat history');
    } finally {
      setLoadingHistory(false);
    }
  }, [activeConvId]);

  // Auto-scroll to bottom of message list
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load conversation list on mount
  useEffect(() => {
    let isSubscribed = true;
    async function fetchConvs() {
      try {
        const res = await fetch('/api/assistant/conversations');
        if (res.ok && isSubscribed) {
          const data = await res.json();
          setConversations(data.conversations || []);
          if (data.conversations && data.conversations.length > 0) {
            setActiveConvId(data.conversations[0].id);
          }
        }
      } catch (_err) {
        if (isSubscribed) toast.error('Failed to load chat history');
      }
    }
    fetchConvs();
    return () => { isSubscribed = false; };
  }, [role]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) return;
    let isSubscribed = true;
    async function fetchMsgs() {
      try {
        const res = await fetch(`/api/assistant/conversations/${activeConvId}/messages`);
        if (res.ok && isSubscribed) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (_err) {
        // ignore
      }
    }
    fetchMsgs();
    return () => { isSubscribed = false; };
  }, [activeConvId]);

  const handleNewChat = async () => {
    try {
      const res = await fetch('/api/assistant/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' })
      });
      if (res.ok) {
        const data = await res.json();
        const newConv = data.conversation;
        setConversations(prev => [newConv, ...prev]);
        setActiveConvId(newConv.id);
        setMessages([]);
      }
    } catch (_err) {
      setActiveConvId(null);
      setMessages([]);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || inputMessage;
    if (!query.trim() || loading) return;

    setInputMessage('');
    setLoading(true);

    const timeStamp = String(new Date().getTime());

    // Optimistic user message
    const tempUserMsg = {
      id: `temp_${timeStamp}`,
      sender: 'user',
      message: query,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          conversation_id: activeConvId || undefined
        })
      });

      if (!res.ok) {
        throw new Error('Assistant API returned an error');
      }

      const data = await res.json();

      // If new conversation was created on backend
      if (data.conversation_id && data.conversation_id !== activeConvId) {
        setActiveConvId(data.conversation_id);
        loadConversations();
      }

      setMessages(prev => {
        // Replace temp or append assistant response
        const filtered = prev.filter(m => m.id !== tempUserMsg.id);
        return [
          ...filtered,
          data.user_message || tempUserMsg,
          data.assistant_message
        ];
      });
    } catch (err) {
      toast.error(err.message || 'Failed to generate response');
      // Append fallback error response
      setMessages(prev => [
        ...prev,
        {
          id: `err_${timeStamp}`,
          sender: 'assistant',
          message: '⚠️ Sorry, I encountered an error connecting to the Intelligence Engine. Please try again.',
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRenameConv = async (convId) => {
    if (!editingTitle.trim()) return;
    try {
      const res = await fetch(`/api/assistant/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle })
      });
      if (res.ok) {
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: editingTitle } : c));
        setEditingConvId(null);
        toast.success('Conversation renamed');
      }
    } catch (_err) {
      toast.error('Failed to rename');
    }
  };

  const handleDeleteConv = async (convId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    try {
      const res = await fetch(`/api/assistant/conversations/${convId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== convId));
        if (activeConvId === convId) {
          const remaining = conversations.filter(c => c.id !== convId);
          setActiveConvId(remaining.length > 0 ? remaining[0].id : null);
        }
        toast.success('Conversation deleted');
      }
    } catch (_err) {
      toast.error('Failed to delete');
    }
  };

  const handleCopyMessage = (text) => {
    navigator.clipboard?.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const handleRetryLast = () => {
    const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
    if (lastUserMsg) {
      handleSendMessage(lastUserMsg.message);
    }
  };

  const handleDownloadConversation = () => {
    if (messages.length === 0) return;
    const textContent = messages.map(m => `[${m.sender.toUpperCase()}] (${new Date(m.created_at).toLocaleTimeString()})\n${m.message}\n\n`).join('---\n\n');
    const blob = new Blob([textContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kucet-assistant-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Conversation downloaded');
  };

  const filteredConvs = conversations.filter(c =>
    (c.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`flex flex-col md:flex-row bg-slate-50 border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden font-sans ${isDrawerMode ? 'h-[85vh]' : 'h-[calc(100vh-140px)] min-h-[550px]'}`}>
      
      {/* ---------------------------------------------------------------- */}
      {/* LEFT SIDEBAR: Conversation History */}
      {/* ---------------------------------------------------------------- */}
      <div className={`${showHistorySidebar ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 bg-slate-900 text-slate-200 border-r border-slate-800 flex-shrink-0 transition-all duration-200`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              AI
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">History</h2>
              <p className="text-[10px] text-slate-400 font-medium">Saved Conversations</p>
            </div>
          </div>
          <button
            onClick={handleNewChat}
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
          >
            <span>+</span> New
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-800">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingHistory ? (
            <div className="flex justify-center p-6 text-slate-400 text-xs">Loading history...</div>
          ) : filteredConvs.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs italic">No saved chats found.</div>
          ) : (
            filteredConvs.map(conv => {
              const isActive = conv.id === activeConvId;
              const isEditing = editingConvId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    if (window.innerWidth < 768) setShowHistorySidebar(false);
                  }}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                    isActive ? 'bg-blue-600/30 border border-blue-500/50 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <span className="text-slate-400 text-xs">💬</span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleRenameConv(conv.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameConv(conv.id)}
                        className="bg-slate-800 border border-blue-400 text-white px-2 py-0.5 rounded text-xs outline-none w-32"
                        autoFocus
                      />
                    ) : (
                      <span className="truncate font-medium">{conv.title}</span>
                    )}
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingConvId(conv.id);
                        setEditingTitle(conv.title);
                      }}
                      className="p-1 text-slate-400 hover:text-white rounded"
                      title="Rename"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => handleDeleteConv(conv.id, e)}
                      className="p-1 text-slate-400 hover:text-red-400 rounded"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* MAIN CHAT AREA */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        
        {/* Top Header */}
        <div className="p-3.5 px-6 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
              className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg text-xs"
            >
              💬 History
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight">{roleMeta.title}</h1>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${roleMeta.color} shadow-xs`}>
                  {roleMeta.badge}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">Smart Campus Intelligence Engine (Offline Rule & Analytics Derived)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="hidden sm:inline-flex px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
            >
              + New Chat
            </button>
            {messages.length > 0 && (
              <button
                onClick={handleDownloadConversation}
                className="p-1.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg text-xs hover:bg-slate-50"
                title="Download Chat Log"
              >
                📥
              </button>
            )}
            {isDrawerMode && onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 text-base font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Message Stream Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50">
          {messages.length === 0 ? (
            /* Welcome & Suggested Prompts */
            <div className="max-w-2xl mx-auto my-auto text-center space-y-6 pt-6 pb-12 animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0b3578] to-blue-600 text-white flex items-center justify-center text-2xl font-black mx-auto shadow-lg">
                ⚡
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-slate-800">Welcome to KUCET Intelligence Assistant</h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Ask questions about your academic standing, rules compliance, attendance trends, or departmental insights.
                </p>
              </div>

              {/* Suggested Prompts Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left max-w-xl mx-auto">
                {promptList.map((prompt, pIdx) => (
                  <button
                    key={pIdx}
                    onClick={() => handleSendMessage(prompt)}
                    className="p-3 bg-white hover:bg-blue-50/60 border border-slate-200/90 hover:border-blue-300 rounded-xl text-xs font-semibold text-slate-700 transition-all shadow-2xs hover:shadow-xs text-left cursor-pointer flex items-center justify-between group"
                  >
                    <span>{prompt}</span>
                    <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message List */
            messages.map((msg, idx) => {
              const isUser = msg.sender === 'user';
              const showExplainability = showExplainabilityMap[msg.id];

              return (
                <div
                  key={msg.id || idx}
                  className={`flex gap-3 max-w-4xl mx-auto ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0b3578] to-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-md flex-shrink-0 mt-1">
                      AI
                    </div>
                  )}

                  <div className={`space-y-2 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`p-4 rounded-2xl text-sm shadow-xs ${
                        isUser
                          ? 'bg-[#0b3578] text-white rounded-tr-none font-medium'
                          : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-none'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                      ) : (
                        <MarkdownRenderer content={msg.message} />
                      )}
                    </div>

                    {/* Metadata / Actions Bar */}
                    <div className={`flex items-center gap-3 text-[11px] text-slate-600 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span>{msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      
                      {!isUser && (
                        <>
                          <button
                            onClick={() => handleCopyMessage(msg.message)}
                            className="hover:text-slate-700 font-medium cursor-pointer"
                          >
                            📋 Copy
                          </button>

                          {idx === messages.length - 1 && (
                            <button
                              onClick={handleRetryLast}
                              className="hover:text-slate-700 font-medium cursor-pointer"
                            >
                              🔄 Retry
                            </button>
                          )}

                          {msg.metadata && (
                            <button
                              onClick={() => startTransition(() => {
                                setShowExplainabilityMap(prev => ({
                                  ...prev,
                                  [msg.id]: !prev[msg.id]
                                }));
                              })}
                              className="text-blue-600 hover:underline font-semibold cursor-pointer"
                            >
                              {showExplainability ? 'Hide Reasoning' : '💡 Why this response?'}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Explainability Breakdown Card */}
                    {!isUser && showExplainability && msg.metadata && (
                      <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs space-y-1.5 text-slate-700 shadow-2xs animate-fadeIn">
                        <div className="font-bold text-amber-900 flex items-center gap-1">
                          💡 Institutional Explainability Proof
                        </div>
                        {msg.metadata.why && <div><strong>Why:</strong> {msg.metadata.why}</div>}
                        {msg.metadata.rulesApplied && (
                          <div><strong>Rules Applied:</strong> {Array.isArray(msg.metadata.rulesApplied) ? msg.metadata.rulesApplied.join(', ') : msg.metadata.rulesApplied}</div>
                        )}
                        {msg.metadata.suggestedAction && <div><strong>Suggested Action:</strong> {msg.metadata.suggestedAction}</div>}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center text-xs shadow-md flex-shrink-0 mt-1">
                      {role === 'student' ? 'ST' : role === 'faculty' ? 'FA' : role === 'hod' ? 'HD' : 'AD'}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {loading && (
            <div className="flex items-center gap-3 max-w-4xl mx-auto">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0b3578] to-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-md">
                AI
              </div>
              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl rounded-tl-none text-xs text-slate-500 font-medium flex items-center gap-2 shadow-2xs">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
                <span>Evaluating rules & calculating statistics...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Form */}
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto flex items-end gap-2 bg-slate-50 border border-slate-300 focus-within:border-blue-500 focus-within:bg-white rounded-2xl p-2 transition-all shadow-inner">
            <textarea
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${roleMeta.title}... (Enter to send, Shift+Enter newline)`}
              className="flex-1 max-h-32 p-2 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none resize-none"
            />
            
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || loading}
              className="p-2.5 bg-gradient-to-r from-[#0b3578] to-blue-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex-shrink-0"
            >
              Send ➔
            </button>
          </div>
          <div className="flex items-center justify-between max-w-4xl mx-auto mt-2 text-[10px] text-slate-600 px-1 font-medium">
            <span>Deterministic Rule-Based Intelligence Engine (100% Offline)</span>
            <span>KUCET College Management System</span>
          </div>
        </div>

      </div>
    </div>
  );
}
