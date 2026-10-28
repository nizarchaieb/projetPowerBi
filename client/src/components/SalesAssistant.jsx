import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { parseSalesRequest } from '../assistant/parseSalesRequest';

export default function SalesAssistant({ options, onApply, context = 'ventes' }) {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const isCancellation = context === 'annulations';
  const title = isCancellation ? 'Posez une question sur les annulations' : 'Posez une question sur vos ventes';
  const placeholder = isCancellation
    ? 'Ex. : montre-moi les annulations du Sud en décembre'
    : 'Ex. : montre-moi les ventes du Sud en décembre';
  const examples = isCancellation
    ? 'Exemples : « annulations du Sud », « commandes annulées en décembre ».'
    : 'Exemples : « ventes du Sud », « commandes annulées en décembre ».';

  useEffect(() => () => {
    if (recognitionRef.current) recognitionRef.current.abort();
  }, []);

  function applyRequest(value) {
    setIsError(false);
    const result = parseSalesRequest(value, options);
    if (result.error) {
      setMessage(result.error);
      setIsError(true);
      return;
    }
    onApply(result.filters);
    setMessage(result.message);
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsError(true);
      setMessage('La reconnaissance vocale n’est pas disponible dans ce navigateur. Essayez Chrome ou saisissez votre demande.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    recognition.onstart = () => {
      setListening(true);
      setIsError(false);
      setMessage('Je vous écoute…');
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      applyRequest(transcript);
    };
    recognition.onerror = (event) => {
      setIsError(true);
      setMessage(event.error === 'not-allowed'
        ? 'Autorisez le microphone dans votre navigateur, puis réessayez.'
        : 'La reconnaissance vocale a échoué. Vous pouvez saisir votre demande.');
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setIsError(true);
      setMessage('Impossible de démarrer le microphone. Vérifiez ses autorisations et réessayez.');
    }
  }

  return (
    <section className="sales-assistant" aria-labelledby="sales-assistant-title">
      <div className="assistant-heading">
        <div className="assistant-mark"><Icon name="sparkle" /></div>
        <div>
          <span className="eyebrow">ASSISTANT DE FILTRAGE</span>
          <h2 id="sales-assistant-title">{title}</h2>
          <p>Écrivez ou dictez une région, un mois, une catégorie ou un statut.</p>
        </div>
      </div>
      <form className="assistant-form" onSubmit={(event) => { event.preventDefault(); applyRequest(query); }}>
        <label className="sr-only" htmlFor="sales-assistant-query">Votre demande</label>
        <input
          id="sales-assistant-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          aria-describedby="assistant-message"
        />
        <button type="button" className={`assistant-mic${listening ? ' listening' : ''}`} onClick={startListening} disabled={listening} aria-label={listening ? 'Écoute en cours' : 'Dicter une demande'}>
          {listening ? 'Écoute…' : '🎙 Dicter'}
        </button>
        <button type="submit" className="btn" disabled={!query.trim()}>Appliquer</button>
      </form>
      <div className="assistant-foot">
        <span id="assistant-message" className={isError ? 'assistant-feedback error-text' : 'assistant-feedback'} aria-live="polite">{message || examples}</span>
        <span className="assistant-private">La demande écrite est interprétée localement ; le traitement vocal dépend du navigateur.</span>
      </div>
    </section>
  );
}
