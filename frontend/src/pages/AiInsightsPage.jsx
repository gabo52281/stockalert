import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Bot, BrainCircuit, PackagePlus, RefreshCw,
  Send, ShieldCheck, Sparkles, TrendingUp, Wallet,
} from 'lucide-react';
import { aiApi } from '../api/endpoints.js';
import { errorMessage } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { formatCurrency, formatDateTime, formatInteger, formatNumber } from '../utils/format.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import Table from '../components/ui/Table.jsx';
import Badge from '../components/ui/Badge.jsx';

const RISK_TONE = {
  CRITICO: 'danger',
  ALTO: 'danger',
  MEDIO: 'info',
  BAJO: 'neutral',
};

const RISK_LABEL = {
  CRITICO: 'Urgente',
  ALTO: 'Pronto',
  MEDIO: 'Revisar',
  BAJO: 'Estable',
};

const CONFIDENCE_LABEL = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
  sin_historial: 'Sin historial',
};

const QUICK_QUESTIONS = [
  '¿Qué debo comprar esta semana?',
  '¿Qué productos se van a agotar?',
  '¿Cuánto necesito invertir?',
  'Tengo $ 500.000 para comprar mercancía. ¿Qué me recomiendas?',
  '¿Cuáles son los productos con menos movimiento?',
  '¿Cómo puedo mejorar mi inventario?',
];

const INITIAL_MESSAGE = {
  role: 'system',
  text: 'El chat genera sus respuestas con OpenRouter (modelo gratuito) usando cifras reales de Neon. Autoriza el envío del resumen para comenzar.',
  at: new Date().toISOString(),
};

export default function AiInsightsPage() {
  const [days, setDays] = useState(30);
  const [leadTimeDays, setLeadTimeDays] = useState(14);
  const { data, loading, error, reload } = useApi(
    () => aiApi.insights({ days, leadTimeDays }).then((response) => response.data),
    [days, leadTimeDays],
  );
  const { data: aiStatus } = useApi(() => aiApi.status().then((response) => response.data), []);

  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [question, setQuestion] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const endRef = useRef(null);

  const externalAvailable = Boolean(aiStatus?.externalModelAvailable);
  const showConsent = externalAvailable && !consent;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, sending]);

  async function sendQuestion(text, consentOverride = null) {
    const clean = String(text || '').trim();
    if (!clean || sending) return;

    const history = messages
      .filter((message) => (message.role === 'user' || message.role === 'assistant') && message.text)
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.text }));

    setQuestion('');
    setPendingQuestion('');
    setChatError('');
    setMessages((previous) => [...previous, { role: 'user', text: clean, at: new Date().toISOString() }]);
    setSending(true);

    try {
      const result = await aiApi.chat({
        question: clean,
        days,
        leadTimeDays,
        consent: consentOverride ?? consent,
        history,
      });
      const response = result.data;
      const text = response.text || response.notice || '';
      setMessages((previous) => [...previous, {
        role: response.outOfService || response.consentRequired ? 'system' : 'assistant',
        text,
        outOfService: Boolean(response.outOfService),
        model: response.model,
        at: new Date().toISOString(),
      }]);
    } catch (err) {
      setChatError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  function requestQuestion(text) {
    if (showConsent) {
      setPendingQuestion(String(text || '').trim());
      setQuestion(String(text || '').trim());
      return;
    }
    sendQuestion(text);
  }

  function acceptConsent() {
    setConsent(true);
    if (pendingQuestion) sendQuestion(pendingQuestion, true);
  }

  function newConversation() {
    setMessages([{ ...INITIAL_MESSAGE, at: new Date().toISOString() }]);
    setQuestion('');
    setPendingQuestion('');
    setChatError('');
  }

  const technicalColumns = [
    { key: 'name', label: 'Producto', render: (row) => <><strong>{row.name}</strong><small className="cell-sub">{row.code}</small></> },
    { key: 'stock', label: 'Stock', align: 'right', render: (row) => formatInteger(row.stock) },
    { key: 'forecastDailyDemand', label: 'Salida diaria', align: 'right', render: (row) => formatNumber(row.forecastDailyDemand) },
    { key: 'daysOfCover', label: 'Días que duraría', align: 'right', render: (row) => (row.daysOfCover === null ? '—' : formatNumber(row.daysOfCover)) },
    { key: 'suggestedQty', label: 'Reponer', align: 'right', render: (row) => formatInteger(row.suggestedQty) },
    { key: 'reorderPoint', label: 'Punto de pedido', align: 'right', render: (row) => formatInteger(row.reorderPoint) },
    { key: 'risk', label: 'Nivel', render: (row) => <Badge tone={RISK_TONE[row.risk] || 'neutral'}>{RISK_LABEL[row.risk] || row.risk}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="Copiloto de inventario"
        description="Todas las respuestas del chat las genera OpenRouter con datos reales de tu inventario."
        actions={(
          <div className="ai-header-actions">
            <div className="period-switch">
              {[7, 30, 90].map((option) => (
                <button key={option} type="button" className={days === option ? 'active' : ''} onClick={() => setDays(option)}>{option} días</button>
              ))}
            </div>
            <button type="button" className="btn btn--sm btn--ghost" onClick={newConversation}>
              <RefreshCw size={14} /> Nueva conversación
            </button>
          </div>
        )}
      />

      {error && (
        <Card className="stat-card stat-card--orange">
          <CardBody>No se pudo cargar el análisis automático. Intenta recargar la página.</CardBody>
        </Card>
      )}

      <div className="ai-summary-grid">
        <Card className="summary-card summary-card--blue">
          <PackagePlus size={21} />
          <div><span>Productos que necesitan atención</span><strong>{formatInteger(data?.summary?.replenishmentProducts || 0)}</strong></div>
        </Card>
        <Card className="summary-card summary-card--critical">
          <AlertTriangle size={21} />
          <div><span>Productos con riesgo de agotarse</span><strong>{formatInteger(data?.summary?.highRiskProducts || 0)}</strong></div>
        </Card>
        <Card className="summary-card summary-card--green">
          <Wallet size={21} />
          <div><span>Inversión estimada para reposición</span><strong>{formatCurrency(data?.summary?.estimatedPurchaseCost || 0)}</strong></div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recomendaciones importantes"
          subtitle="Ordenadas por urgencia, existencias y salidas recientes"
          action={<button type="button" className="btn btn--sm btn--ghost" onClick={reload}>Actualizar</button>}
        />
        <CardBody>
          {data?.recommendations?.length ? (
            <div className="ai-recommendation-list">
              {data.recommendations.slice(0, 4).map((item) => (
                <div key={item.id} className="ai-recommendation">
                  <span className="ai-recommendation__icon"><TrendingUp size={17} /></span>
                  <div className="ai-recommendation__body">
                    <div className="ai-recommendation__title">
                      <strong>{item.name}</strong>
                      <Badge tone={RISK_TONE[item.risk] || 'neutral'}>{RISK_LABEL[item.risk] || item.risk}</Badge>
                    </div>
                    <small>{item.code} · {item.category}</small>
                    <p>{item.simpleReason || item.reason}</p>
                  </div>
                  <div className="ai-recommendation__action">
                    <span>Reponer</span>
                    <strong>{formatInteger(item.suggestedQty)} uds.</strong>
                    <small>{formatCurrency(item.suggestedQty * item.purchasePrice)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="card__subtitle">{loading ? 'Analizando movimientos…' : 'No hay recomendaciones urgentes en este momento.'}</p>
          )}
        </CardBody>
      </Card>

      <Card className="ai-chat">
        <CardHeader
          title="Chat con tu copiloto"
          subtitle="Historial de esta sesión · OpenRouter gratuito con cifras de Neon"
          action={(
            <Badge tone={externalAvailable ? 'info' : 'danger'}>
              {externalAvailable ? <Sparkles size={13} /> : <AlertTriangle size={13} />}
              {externalAvailable ? 'OpenRouter gratuito' : 'IA temporalmente fuera de servicio'}
            </Badge>
          )}
        />
        <CardBody>
          {showConsent && (
            <div className="ai-consent">
              <ShieldCheck size={18} />
              <div>
                <strong>Antes de usar OpenRouter</strong>
                <p>
                  Solo se enviará un resumen agregado (productos, existencias, cantidades sugeridas y precios).
                  No se envían usuarios, correos ni credenciales. Sin esta autorización el chat no genera respuestas.
                </p>
              </div>
              <div className="ai-consent__actions">
                <button type="button" className="btn btn--sm btn--primary" onClick={acceptConsent}>Autorizar resumen</button>
              </div>
            </div>
          )}

          <div className="ai-chat__messages">
            {messages.map((message, index) => {
              const isSystem = message.role === 'system';
              const isOutage = Boolean(message.outOfService);
              return (
                <div key={`${message.role}-${index}`} className={`ai-message ai-message--${isSystem ? 'system' : message.role}`}>
                  <span className="ai-message__avatar">
                    {isSystem
                      ? (isOutage ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />)
                      : (message.role === 'assistant' ? <Bot size={16} /> : 'Tú')}
                  </span>
                  <div className="ai-message__body">
                    <div className="ai-message__meta">
                      <strong>{isSystem ? 'Sistema' : (message.role === 'assistant' ? 'Copiloto' : 'Tú')}</strong>
                      {message.role === 'assistant' && <span>OpenRouter · modelo gratuito</span>}
                      {isOutage && <span>Servicio no disponible</span>}
                      {message.at && <time>{formatDateTime(message.at)}</time>}
                    </div>
                    <div className="ai-message__bubble">
                      {String(message.text || '').split('\n').map((line, lineIndex) => <p key={lineIndex}>{line}</p>)}
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
              <button key={item} type="button" onClick={() => requestQuestion(item)} disabled={sending}>{item}</button>
            ))}
          </div>

          <form className="ai-chat__composer" onSubmit={(event) => { event.preventDefault(); requestQuestion(question); }}>
            <textarea
              className="ai-chat__input"
              rows="2"
              value={question}
              placeholder="Escribe tu pregunta…"
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  requestQuestion(question);
                }
              }}
            />
            <button type="submit" className="btn btn--primary ai-chat__send" disabled={sending || !question.trim()}>
              <Send size={15} /> Enviar
            </button>
          </form>
        </CardBody>
      </Card>

      <details className="ai-technical">
        <summary><BrainCircuit size={16} /> Cómo funciona el cálculo automático</summary>
        <div className="ai-technical__body">
          <p>
            Estos cálculos no redactan las respuestas del chat: solo preparan el resumen agregado que se envía
            a OpenRouter. El motor de STOCKALERT estima la salida diaria con el historial reciente, calcula
            cuánto duraría cada producto y define una cantidad sugerida para cubrir {leadTimeDays} días de
            reposición. Las alertas de stock mínimo siguen siendo la fuente oficial del estado de cada producto.
          </p>
          <div className="formula-banner">
            <BrainCircuit size={18} />
            <span>
              Ventana de análisis: {days} días · Tiempo estimado de reposición: {leadTimeDays} días.
              Confianza: alta = 7 o más días con salidas, media = 3 a 6, baja = 1 o 2.
            </span>
            <select
              className="select"
              value={leadTimeDays}
              onChange={(event) => setLeadTimeDays(Number(event.target.value))}
              aria-label="Tiempo estimado de reposición"
            >
              {[7, 14, 21, 30].map((option) => <option key={option} value={option}>{option} días</option>)}
            </select>
          </div>
          <Table
            columns={technicalColumns}
            rows={data?.recommendations}
            loading={loading}
            emptyMessage="No hay productos con reposición sugerida"
          />
          <p className="disclaimer">
            {data?.narrative} Confianza: {CONFIDENCE_LABEL[data?.recommendations?.[0]?.forecastConfidence] || '—'}.
          </p>
        </div>
      </details>
    </>
  );
}
