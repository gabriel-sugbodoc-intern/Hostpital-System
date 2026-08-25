import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { MessageSquare, Send, ArrowLeft, Smartphone, User, Search, Loader2, Radio, CheckCircle2, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { testTwilioConnectionServerFn, getTwilioConfigServerFn, sendTwilioSmsServerFn } from '@/lib/twilio-api';

type Patient = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
};

type Msg = {
  id: string;
  sender: string;
  text?: string | null;
  createdAt: string;
  smsStatus?: string | null;
  smsTo?: string | null;
  smsFrom?: string | null;
  smsError?: string | null;
};

export default function AdminMessaging() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sendSms, setSendSms] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Twilio Diagnostic Modal State
  const [showTwilioModal, setShowTwilioModal] = useState(false);
  const [testingTwilio, setTestingTwilio] = useState(false);
  const [twilioStatus, setTwilioStatus] = useState<any>(null);
  const [testPhoneNumber, setTestPhoneNumber] = useState('+18777804236');
  const [testMessageBody, setTestMessageBody] = useState('Hello from SugboDoc Twilio Integration Test!');
  const [sendingTestSms, setSendingTestSms] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  const checkTwilioConnection = async () => {
    setTestingTwilio(true);
    try {
      const [res, config] = await Promise.all([
        (testTwilioConnectionServerFn as any)(),
        (getTwilioConfigServerFn as any)().catch(() => null),
      ]);
      setTwilioStatus({ ...res, fromNumber: config?.fromNumber });
      if (res.unauthorized) {
        toast.error(res.error || "You are not authorized to run Twilio diagnostics.");
      } else if (res.connected) {
        toast.success(`Twilio connected: ${res.friendlyName || res.accountSid}`);
      } else {
        toast.error(`Twilio connection issue: ${res.error || 'Check credentials'}`);
      }
    } catch (e: any) {
      setTwilioStatus({ connected: false, error: e.message });
      toast.error('Failed to contact Twilio API');
    } finally {
      setTestingTwilio(false);
    }
  };

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhoneNumber.trim() || !testMessageBody.trim() || sendingTestSms) return;
    setSendingTestSms(true);
    try {
      const res = await (sendTwilioSmsServerFn as any)({
        data: {
          to: testPhoneNumber.trim(),
          body: testMessageBody.trim(),
        },
      });
      if (res.success) {
        toast.success(`SMS dispatched successfully via Twilio! SID: ${res.sid}`, {
          description: `Delivering to ${res.to || testPhoneNumber.trim()}${res.from ? ` from ${res.from}` : ''}`,
        });
        void checkTwilioConnection();
      } else if (res.unauthorized) {
        toast.error(res.error || 'You are not authorized to send SMS.');
      } else {
        toast.error(`Twilio SMS Error: ${res.error || 'Delivery failed'}`);
      }
    } catch (e: any) {
      toast.error(e.message || 'SMS test failed');
    } finally {
      setSendingTestSms(false);
    }
  };

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
  }, [msgText]);

  useEffect(() => {
    setLoadingPatients(true);
    apiClient.getAdminMessagingPatients(search || undefined)
      .then(({ data, error }) => {
        if (error) toast.error(error);
        else if (data) setPatients((data as any).patients ?? []);
      })
      .finally(() => setLoadingPatients(false));
  }, [search]);

  useEffect(() => {
    if (!selectedPatient) { setMessages([]); return; }
    setLoadingMsgs(true);
    apiClient.getAdminConversation(selectedPatient.id)
      .then(({ data, error }) => {
        if (error) toast.error(error);
        else if (data) setMessages((data as any).messages ?? []);
      })
      .finally(() => setLoadingMsgs(false));
  }, [selectedPatient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const submittedText = msgText.trim();
    if (!submittedText || !selectedPatient || sending) return;
    setSending(true);
    const result = await apiClient.sendAdminMessage(selectedPatient.id, submittedText, sendSms);
    if (result.error) {
      setSending(false);
      toast.error(result.error);
      focusMessageInput();
      return;
    }
    setMessages(prev => [...prev, (result.data as any).message]);
    setMsgText(current => current.trim() === submittedText ? '' : current);
    setSending(false);
    focusMessageInput();
    const sms = (result.data as any)?.sms;
    if (sendSms) {
      if (sms?.sent) toast.success(`Message saved and SMS sent to ${sms.to || 'the patient'}.`, {
        description: `Twilio SID: ${sms.sid ?? 'n/a'}`,
      });
      else toast.warning(`Message saved, but SMS delivery failed: ${sms?.reason ?? 'Unknown delivery error.'}`);
    } else toast.success('Message saved to the conversation.');
  };

  const renderPatientList = () => (
    <div className={`flex flex-col border-r border-border bg-card ${selectedPatient ? 'hidden md:flex md:w-72 shrink-0' : 'flex flex-1'}`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-foreground">Messaging</h1>
          <button
            type="button"
            onClick={() => {
              setShowTwilioModal(true);
              if (!twilioStatus) void checkTwilioConnection();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            title="View Twilio Status & Test SMS"
          >
            <Radio className="w-3 h-3 animate-pulse text-emerald-500" />
            Twilio
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patients..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {loadingPatients ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded" />
              </div>
            </div>
          ))
        ) : patients.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No patients found</p>
          </div>
        ) : (
          patients.map(patient => (
            <button
              key={patient.id}
              onClick={() => setSelectedPatient(patient)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                selectedPatient?.id === patient.id ? 'bg-accent' : 'hover:bg-muted'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                {patient.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground text-sm truncate">{patient.name}</div>
                <div className="text-xs text-muted-foreground truncate">{patient.phone ?? patient.email}</div>
              </div>
              {patient.phone && (
                <Smartphone className="w-3.5 h-3.5 text-primary shrink-0" aria-label="Has phone number" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );

  const renderConversationView = () => (
    <div className={`flex-1 flex flex-col ${!selectedPatient ? 'hidden md:flex items-center justify-center bg-muted/20' : 'flex'}`}>
      {!selectedPatient ? (
        <div className="text-center text-muted-foreground p-8">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-foreground">Select a patient</p>
          <p className="text-sm mt-1">Choose a patient to start or view a conversation</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="h-16 px-4 border-b border-border flex items-center gap-3 bg-card sticky top-0 z-10 shrink-0">
            <button onClick={() => setSelectedPatient(null)} className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
              {selectedPatient.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-foreground leading-tight">{selectedPatient.name}</h2>
            <p className="text-xs text-muted-foreground">{selectedPatient.email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowTwilioModal(true);
                if (!twilioStatus) void checkTwilioConnection();
              }}
              className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 hover:bg-primary/20 transition-colors px-2.5 py-1 rounded-full shrink-0"
              title="Click to check Twilio connection"
            >
              <Smartphone className="w-3.5 h-3.5" />
              SMS → {selectedPatient.phone || "No phone on file"}
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
            {loadingMsgs ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-16">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs mt-1">Send a message below to start the conversation</p>
              </div>
            ) : (
              messages.map(msg => {
                const isAdmin = msg.sender === 'doctor';
                return (
                  <div key={msg.id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isAdmin
                        ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-sm'
                        : 'bg-card border border-border text-foreground rounded-tl-sm'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 px-1">
                      {isAdmin ? 'You' : selectedPatient.name} ·{' '}
                       {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       {isAdmin && msg.smsStatus && ` · SMS ${msg.smsStatus === 'sent' ? 'sent' : 'failed'}`}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border bg-card shrink-0">
            <label className="flex items-center gap-2 text-xs text-muted-foreground mb-3 cursor-pointer select-none">
              <input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)} className="rounded border-input w-4 h-4" />
              <Smartphone className="w-3.5 h-3.5 text-primary" />
              Send via Twilio SMS to <span className="font-mono text-foreground">{selectedPatient.phone || "No phone on file"}</span>
            </label>
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <textarea
                ref={messageInputRef}
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                placeholder={`Message ${selectedPatient.name}…`}
                className="flex-1 min-h-[42px] max-h-40 resize-none overflow-hidden bg-muted/50 rounded-2xl px-4 py-2.5 text-sm leading-5 border-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label={`Message ${selectedPatient.name}`}
              />
              <button
                type="submit"
                disabled={!msgText.trim() || sending}
                className="p-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="h-[calc(100vh-8rem)] -mt-4 md:-mt-6 -mx-4 md:-mx-6 flex overflow-hidden border-t md:border border-border md:rounded-xl shadow-sm relative">
      {renderPatientList()}
      {renderConversationView()}

      {/* Twilio Diagnostic Modal */}
      {showTwilioModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Twilio Gateway Diagnostics</h2>
                  <p className="text-xs text-muted-foreground">Verify credentials and live SMS delivery</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTwilioModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Connection Test Box */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Connection Status</span>
                <button
                  type="button"
                  onClick={checkTwilioConnection}
                  disabled={testingTwilio}
                  className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${testingTwilio ? 'animate-spin' : ''}`} />
                  {testingTwilio ? 'Testing...' : 'Test Now'}
                </button>
              </div>

              {testingTwilio ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Testing Twilio API endpoint authentication…
                </div>
              ) : twilioStatus ? (
                twilioStatus.connected ? (
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Connected to Twilio Account
                    </div>
                    <div className="text-muted-foreground grid grid-cols-2 gap-1 pt-1 text-[11px]">
                      <div>Account SID: <span className="font-mono text-foreground">{twilioStatus.accountSid?.slice(0, 8)}…{twilioStatus.accountSid?.slice(-4)}</span></div>
                      <div>Status: <span className="capitalize font-medium text-foreground">{twilioStatus.status}</span></div>
                      <div>Friendly Name: <span className="text-foreground">{twilioStatus.friendlyName}</span></div>
                      <div>Type: <span className="text-foreground">{twilioStatus.type}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">Connection Error</div>
                      <div className="text-muted-foreground text-[11px]">{twilioStatus.error}</div>
                    </div>
                  </div>
                )
              ) : (
                <p className="text-xs text-muted-foreground">Click &ldquo;Test Now&rdquo; to query the Twilio API.</p>
              )}
            </div>

            {/* Test SMS Sender Form */}
            <form onSubmit={handleSendTestSms} className="space-y-3">
              <h3 className="text-xs font-semibold text-foreground">Send Live Test SMS</h3>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-muted/40 border border-border">
                  <span className="text-muted-foreground block">Sender (From)</span>
                  <span className="font-mono font-medium text-foreground">{twilioStatus?.fromNumber || "Not configured"}</span>
                </div>
                <div className="p-2 rounded-lg bg-muted/40 border border-border">
                  <span className="text-muted-foreground block">Default Target (To)</span>
                  <span className="font-mono font-medium text-foreground">+18777804236</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Recipient Phone Number (E.164 format)</label>
                <input
                  type="text"
                  value={testPhoneNumber}
                  onChange={e => setTestPhoneNumber(e.target.value)}
                  placeholder="+18777804236 or +639171234567"
                  className="w-full px-3 py-2 text-xs border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Message Body</label>
                <textarea
                  value={testMessageBody}
                  onChange={e => setTestMessageBody(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTwilioModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={sendingTestSms || !testPhoneNumber.trim() || !testMessageBody.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg disabled:opacity-50"
                >
                  {sendingTestSms ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Dispatch SMS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

