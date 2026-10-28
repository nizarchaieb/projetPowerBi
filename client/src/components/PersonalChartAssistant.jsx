import React, { useState } from 'react';
import Icon from './Icon';
import { Link } from 'react-router-dom';
import { answerChartQuestion } from '../workspace/chartInsights';

const PROMPTS = [
  { id: 'trend', label: 'Quelle est la tendance ?' },
  { id: 'category', label: 'Quelle catégorie arrive en tête ?' },
  { id: 'status', label: 'Quel est le statut principal ?' },
  { id: 'scope', label: 'Combien de lignes sont analysées ?' },
];

export default function PersonalChartAssistant({ insights, onFilterCategory, onResetFilters }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  function ask(value) {
    setAnswer(answerChartQuestion(value, insights));
    setQuestion(value);
  }

  function submit(event) {
    event.preventDefault();
    if (question.trim()) ask(question);
  }

  const category = insights.find((insight) => insight.id === 'category')?.category;

  return (
    <section className="chart-ai-assistant" aria-labelledby="chart-ai-title">
      <div className="chart-ai-heading">
        <div className="assistant-mark"><Icon name="sparkle" /></div>
        <div>
          <span className="eyebrow">ANALYSE LOCALE DE VOS GRAPHIQUES</span>
          <h2 id="chart-ai-title">Votre assistant d’analyse</h2>
          <p>Des observations calculées depuis les données filtrées ci-dessous, pour repérer rapidement les tendances et les points importants.</p>
        </div>
      </div>

      {insights.length ? (
        <div className="chart-ai-insights">
          {insights.map((insight) => (
            <article className="chart-ai-insight" key={insight.id}>
              <span className="chart-ai-insight-mark"><Icon name={insight.id === 'trend' ? 'chart' : insight.id === 'category' ? 'dashboard' : insight.id === 'status' ? 'cancel' : 'orders'} /></span>
              <div><h3>{insight.title}</h3><p>{insight.detail}</p>{insight.calculation ? <small>Calcul : {insight.calculation}</small> : null}</div>
            </article>
          ))}
        </div>
      ) : <p className="chart-ai-empty">Importez des données contenant des dates ou des catégories pour obtenir des analyses de graphiques.</p>}

      <div className="chart-ai-actions">
        {category?.column ? <button type="button" className="btn secondary small" onClick={() => onFilterCategory(category.column, category.label)}>Filtrer sur « {category.label} »</button> : null}
        <button type="button" className="btn secondary small" onClick={onResetFilters}>Réinitialiser les filtres</button>
        <Link className="btn secondary small" to="/bi/commandes">Consulter toutes les lignes</Link>
      </div>

      <form className="chart-ai-question-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="chart-ai-question">Poser une question sur les graphiques</label>
        <input
          id="chart-ai-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ex. : Quelle est la tendance des ventes ?"
          aria-describedby="chart-ai-answer chart-ai-privacy"
        />
        <button className="btn" type="submit" disabled={!question.trim()}>Répondre</button>
      </form>
      <div className="chart-ai-prompts" aria-label="Questions suggérées">
        {PROMPTS.map((prompt) => (
          <button type="button" key={prompt.id} onClick={() => ask(prompt.label)}>{prompt.label}</button>
        ))}
      </div>
      <p id="chart-ai-answer" className="chart-ai-answer" aria-live="polite">{answer}</p>
      <p id="chart-ai-privacy" className="chart-ai-privacy">Analyse déterministe exécutée dans votre navigateur : vos données ne sont pas envoyées à une IA externe. Les résultats sont des indications, pas des prévisions.</p>
    </section>
  );
}
