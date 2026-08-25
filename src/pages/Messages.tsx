import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Send, ArrowLeft, MoreVertical, Paperclip, MessageSquare, FileCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { generateSoapFromDocument } from '@/lib/mock-data';
import { apiClient } from '@/lib/api-client';
import { demoConversations, type DemoConversation } from '@/lib/portal-demo-data';

type Message = {
  id: string;
  sender: string;
  text?: string;
  file?: { name: string; size: string };
  time: string;
  isSystem?: boolean;
  read?: boolean;
  status?: 'Sent' | 'Delivered' | 'Read';
};

type InboxItem = {
  id: string;
  doctor: { name: string; specialty: string; avatar: string };
  preview: string;
  time: string;
  unread: number;
  demo?: boolean;
};

// ── Persistence helpers ────────────────────────────────────────────────────
export default function Messages() {
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [demoHistory, setDemoHistory] = useState<Record<string, Message[]>>(() =>
    Object.fromEntries(demoConversations.map(conversation => [
      conversation.id,
      conversation.messages.map(message => ({ ...message })),
    ])),
  );
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  const resizeMessageInput = () => {
    const input = messageInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const maxHeight = 160;
    const nextHeight = Math.min(input.scrollHeight, maxHeight);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  const focusMessageInput = () => {
    requestAnimationFrame(() => {
      messageInputRef.current?.focus();
      resizeMessageInput();
    });
  };

  useLayoutEffect(() => {
    resizeMessageInput();
  }, [inputValue]);

  useEffect(() => {
    apiClient.getAccountData().then(({ data }) => {
      const grouped = new Map<string, InboxItem>();
      for (const message of data?.messages ?? []) {
        const id = String(message.doctorId);
        if (!grouped.has(id)) {
          const doctorName = String(message.doctorName);
          grouped.set(id, { id, doctor: { name: doctorName, specialty: String(message.specialty), avatar: doctorName.split(' ').map(p => p[0]).join('').slice(0, 2) }, preview: String(message.text ?? message.fileName ?? ''), time: new Date(String(message.createdAt)).toLocaleString(), unread: 0 });
        }
      }
      const accountItems = [...grouped.values()];
      const accountIds = new Set(accountItems.map(item => item.id));
      const demoItems = demoConversations
        .filter(conversation => !accountIds.has(conversation.id))
        .map(conversation => ({
          id: conversation.id,
          doctor: conversation.contact,
          preview: conversation.messages.at(-1)?.text ?? '',
          time: conversation.messages.at(-1)?.time ?? '',
          unread: conversation.unread,
          demo: true,
        }));
      setInbox([...accountItems, ...demoItems]);
    }).finally(() => setIsLoading(false));
  }, []);

  // Load messages when thread changes
  useEffect(() => {
    if (!activeThread) return;
    setPendingMessage(null);
    if (activeThread.startsWith('demo-')) {
      setMessages(demoHistory[activeThread] ?? []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } else {
      setMessages([]);
      apiClient.getConversationMessages(activeThread).then(({ data }) => {
        if (data) {
          setMessages(data.messages.map((m: any) => ({
            id: m.id,
            sender: m.sender === 'patient' ? 'patient' : 'doctor',
            text: m.text ?? undefined,
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: true,
            status: 'Delivered' as const,
          })));
        }
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
    }
  }, [activeThread]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (activeThread && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeThread]);

  const sendWithinPlatform = async (text: string) => {
    if (!activeThread) return;
    const activeInboxItem = inbox.find(i => i.id === activeThread);
    if (!activeInboxItem) return;
    const newMsg: Message = {
      id: `t${Date.now()}`,
      sender: 'patient',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: true,
      status: 'Delivered',
    };
    if (activeThread.startsWith('demo-')) {
      setDemoHistory(previous => ({ ...previous, [activeThread]: [...(previous[activeThread] ?? []), newMsg] }));
    } else {
      const result = await apiClient.sendPatientMessage({ doctorId: activeThread, doctorName: activeInboxItem.doctor.name, specialty: activeInboxItem.doctor.specialty, text });
      if (result.error) {
        toast.error(result.error);
        focusMessageInput();
        return;
      }
    }
    setMessages(prev => [...prev, newMsg]);
    setInputValue(current => current.trim() === text ? '' : current);
    setPendingMessage(null);
    focusMessageInput();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeThread) return;
    await sendWithinPlatform(inputValue.trim());
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeThread) return;

    const sizeKB = Math.round(file.size / 1024);
    const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

    const activeDoctor = inbox.find(i => i.id === activeThread);
    if (!activeDoctor) return;

    const fileMsg: Message = {
      id: `f${Date.now()}`,
      sender: 'patient',
      file: { name: file.name, size: sizeStr },
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    if (activeThread.startsWith('demo-')) {
      setDemoHistory(previous => ({ ...previous, [activeThread]: [...(previous[activeThread] ?? []), fileMsg] }));
    }
    const result = activeThread.startsWith('demo-')
      ? { error: undefined }
      : await apiClient.sendPatientMessage({ doctorId: activeThread, doctorName: activeDoctor.doctor.name, specialty: activeDoctor.doctor.specialty, fileName: file.name });
    if (result.error) { toast.error(result.error); return; }
    setMessages(prev => [...prev, fileMsg]);

    setIsGenerating(true);

    setTimeout(() => {
      const ackMsg: Message = {
        id: `ack${Date.now()}`,
        sender: 'doctor',
        text: `Thank you for sending "${file.name}". I'm reviewing it now.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, ackMsg]);
    }, 1200);

    setTimeout(() => {
      const doctorName = activeDoctor.doctor.name;
      generateSoapFromDocument(file.name, doctorName);
      const soapMsg: Message = {
        id: `soap${Date.now()}`,
        sender: 'system',
        text: `SOAP note generated from "${file.name}" and saved to your Medical Records.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSystem: true,
      };
      setMessages(prev => [...prev, soapMsg]);
      setIsGenerating(false);

      toast.success('SOAP note generated', {
        description: 'View it under Records > SOAP Notes tab.',
        duration: 5000,
      });
    }, 3000);

    e.target.value = '';
  };

  const activeInboxItem = activeThread ? inbox.find(i => i.id === activeThread) : undefined;
  const activeDoctor = activeInboxItem?.doctor;

  const renderInboxView = () => (
    <div className={`flex flex-col ${activeThread ? 'hidden md:flex md:w-80 md:border-r border-border shrink-0' : 'flex flex-1'}`}>
      <div className="p-4 border-b border-border sticky top-0 bg-background z-10">
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground">Your doctor conversations</p>
      </div>
      <div className="overflow-y-auto flex-1 p-2 space-y-1">
        {isLoading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="p-3 flex items-center gap-3 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-full" />
              </div>
            </div>
          ))
        ) : (
          inbox.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveThread(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left min-h-[64px] ${
                activeThread === item.id ? 'bg-accent' : 'hover:bg-muted'
              }`}
            >
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {item.doctor.avatar}
                </div>
                {item.unread > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-card">
                    {item.unread}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="font-semibold text-foreground truncate">{item.doctor.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{item.time}</span>
                </div>
                <p className={`text-sm truncate ${item.unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {item.preview}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const renderChatView = () => (
    <div className={`flex-1 flex flex-col bg-card/30 ${!activeThread ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
      {!activeThread ? (
        <div className="text-center text-muted-foreground p-8">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium">Select a conversation</p>
          <p className="text-sm mt-1">Choose a doctor from the list to start messaging</p>
        </div>
      ) : activeDoctor ? (
        <>
          {/* Chat Header */}
          <div className="h-16 px-4 border-b border-border flex items-center justify-between bg-card sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveThread(null)}
                className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                {activeDoctor.avatar}
              </div>
              <div>
                <h2 className="font-semibold text-foreground">{activeDoctor.name}</h2>
                <p className="text-xs text-muted-foreground">{activeDoctor.specialty}</p>
              </div>
            </div>
            <button className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>

          {/* Document upload hint */}
          <div className="px-4 py-2 bg-accent/60 border-b border-primary/10 flex items-center gap-2 text-xs text-primary">
            <Paperclip className="w-3.5 h-3.5 shrink-0" />
            <span>Send a lab result, prescription, or imaging report to automatically generate a SOAP note.</span>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              if (msg.isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20 max-w-xs text-center">
                      <FileCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>{msg.text}</span>
                    </div>
                  </div>
                );
              }

              const isDoc = msg.sender === 'doctor';
              return (
                <div key={msg.id} className={`flex flex-col ${isDoc ? 'items-start' : 'items-end'}`}>
                  {msg.file ? (
                    <div className={`max-w-[85%] sm:max-w-[70%] p-3 rounded-2xl border ${
                      isDoc
                        ? 'bg-card border-border text-foreground rounded-tl-sm'
                        : 'bg-primary/10 border-primary/20 text-primary rounded-tr-sm'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                          <Paperclip className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{msg.file.name}</p>
                          <p className="text-xs text-muted-foreground">{msg.file.size}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`max-w-[85%] sm:max-w-[75%] p-3 rounded-2xl ${
                      isDoc
                        ? 'bg-card border border-border text-foreground rounded-tl-sm'
                        : 'bg-primary text-primary-foreground rounded-tr-sm shadow-sm'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                  )}
                  <span className="text-[10px] text-muted-foreground mt-1 px-1">
                    {msg.time}{msg.sender === 'patient' && msg.status ? ` · ${msg.status}` : ''}
                  </span>
                </div>
              );
            })}

            {isGenerating && (
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  {activeDoctor.avatar}
                </div>
                <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-card border-t border-border shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="hidden"
              onChange={handleFileSelect}
            />
            {pendingMessage && (
              <div className="mb-3 rounded-xl border border-primary/20 bg-accent/40 p-3">
                <p className="text-xs text-muted-foreground line-clamp-2">“{pendingMessage}”</p>
              </div>
            )}
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
              <Smartphone className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span>
                Clinic updates may also reach you by SMS on your registered mobile number. SMS replies are not
                available here — message your doctor in this chat instead.
              </span>
            </div>
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-muted-foreground hover:bg-muted hover:text-primary rounded-full transition-colors shrink-0"
                title="Attach document"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <textarea
                ref={messageInputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                placeholder="Type a message..."
                className="flex-1 min-h-[42px] max-h-40 resize-none overflow-hidden bg-muted/50 border-none rounded-2xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm leading-5"
                aria-label="Type a message"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="p-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] -mt-4 md:-mt-8 -mx-4 md:-mx-8 flex overflow-hidden border-t md:border border-border md:rounded-xl shadow-sm bg-background">
      {renderInboxView()}
      {renderChatView()}
    </div>
  );
}
