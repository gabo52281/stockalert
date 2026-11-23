import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Bot, MessageCircle, RefreshCw, Send, Sparkles,
} from 'lucide-react';
import { aiApi } from '../api/endpoints.js';
import { errorMessage } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { formatDateTime } from '../utils/format.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';

const QUICK_QUESTIONS = [
  '¿Qué debo comprar esta semana?',
  '¿Qué productos se van a agotar?',
  '¿Cuánto necesito invertir?',
  'Tengo $ 500.000 para comprar mercancía. ¿Qué me recomiendas?',
  '¿Cuáles tienen menos movimiento?',
  '¿Cómo puedo mejorar mi inventario?',
];

const INITIAL_MESSAGE = {
  role: 'system',
  text: '¡Hola! Soy tu asistente de inventario. Puedo ayudarte a decidir qué reponer, detectar productos en riesgo y explicarte las cifras de tu establecimiento. ¿Qué necesitas revisar?',
  at: new Date().toISOString(),
};

export default function AiInsightsPage() {
  const { data: aiStatus } = useApi(() => aiApi.status().then((response) => response.data), []);

  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const endRef = useRef(null);

  const externalAvailable = Boolean(aiStatus?.externalModelAvailable);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, sending]);

  async function sendQuestion(text) {
    const clean = String(text || '').trim();
    if (!clean || sending) return;

    const history = messages
      .filter((message) => (message.role === 'user' || message.role === 'assistant') && message.text)
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.text }));

    setQuestion('');
    setChatError('');
    setMessages((previous) => [...previous, { role: 'user', text: clean, at: new Date().toISOString() }]);
    setSending(true);

    try {
      const result = await aiApi.chat({ question: clean, history });
      const response = result.data;
      setMessages((previous) => [...previous, {
        role: response.outOfService ? 'system' : 'assistant',
        text: response.text || response.notice || '',
        outOfService: Boolean(response.outOfService),
        at: new Date().toISOString(),
      }]);
    } catch (err) {
      setChatError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  function newConversation() {
    setMessages([{ ...INITIAL_MESSAGE, at: new Date().toISOString() }]);
    setQuestion('');
    setChatError('');
  }

  return (
    <div className="ai-page">
      <PageHeader
        title="Asistente IA"
        description="Habla con el asistente de STOCKALERT. Sus respuestas se basan en las cifras reales y aisladas de tu establecimiento."
        actions={(
          <button type="button" className="btn btn--sm btn--ghost" onClick={newConversation}>
            <RefreshCw size={14} /> Nueva conversación
          </button>
        )}
      />

      <Card className="ai-chat">
        <CardHeader
          title="Chat de inventario"
          subtitle="Sincronizado con tus productos, existencias y movimientos"
          action={(
            <Badge tone={externalAvailable ? 'info' : 'danger'}>
              {externalAvailable ? <Sparkles size={13} /> : <AlertTriangle size={13} />}
              {externalAvailable ? 'Asistente IA activo' : 'IA temporalmente fuera de servicio'}
            </Badge>
          )}
        />
        <CardBody>
          <div className="ai-chat__messages">
            {messages.map((message, index) => {
              const isSystem = message.role === 'system';
              const isOutage = Boolean(message.outOfService);
              return (
                <div key={`${message.role}-${index}`} className={`ai-message ai-message--${isSystem ? 'system' : message.role}`}>
                  <span className="ai-message__avatar">
                    {isSystem
                      ? (isOutage ? <AlertTriangle size={16} /> : <MessageCircle size={16} />)
                      : message.role === 'assistant' ? <Bot size={16} /> : 'Tú'}
                  </span>
                  <div className="ai-message__body">
                    <div className="ai-message__meta">
                      <strong>{isSystem ? 'Asistente' : (message.role === 'assistant' ? 'Asistente IA' : 'Tú')}</strong>
                      {message.at && <time>{formatDateTime(message.at)}</time>}
                    </div>
                    <div className="ai-message__bubble">
                      {String(message.text || '').split('\n').filter(Boolean).map((line, lineIndex) => <p key={lineIndex}>{line}</p>)}
                    </div>
                  </div>
                </div>
              );
            })}
            {sending && (
              <div className="ai-thinking"><span className="ai-thinking__dot" /><span className="ai-thinking__dot" /><span className="ai-thinking__dot" /> Pensando…</div>
            )}
            <div ref={endRef} />
          </div>

          {chatError && <div className="ai-chat__error">{chatError}</div>}

          <div className="ai-chat__quick">
            {QUICK_QUESTIONS.map((item) => (
              <button key={item} type="button" onClick={() => sendQuestion(item)} disabled={sending}>{item}</button>
            ))}
          </div>

          <form className="ai-chat__composer" onSubmit={(event) => { event.preventDefault(); sendQuestion(question); }}>
            <textarea
              className="ai-chat__input"
              rows="2"
              value={question}
              placeholder="Escribe tu pregunta…"
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendQuestion(question);
                }
              }}
            />
            <button type="submit" className="btn btn--primary ai-chat__send" disabled={sending || !question.trim()}>
              <Send size={15} /> Enviar
            </button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
