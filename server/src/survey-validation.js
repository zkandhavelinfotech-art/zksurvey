'use strict';
const { HttpError } = require('./util');

function toArr(a) {
  if (a == null || a === '') return [];
  if (Array.isArray(a)) return a.map(String);
  if (typeof a === 'object') return Object.values(a).some(v => v && v !== false) ? ['(filled)'] : [];
  return [String(a)];
}

function testCond(c, eff) {
  const a = eff[c.qid], arr = toArr(a), v = c.value;
  switch (c.op) {
    case 'equals': return arr.length === 1 && arr[0] === v;
    case 'not_equals': return !(arr.length === 1 && arr[0] === v);
    case 'contains': return arr.some(x => x === v || String(x).toLowerCase().includes(String(v).toLowerCase()));
    case 'not_contains': return !arr.some(x => x === v || String(x).toLowerCase().includes(String(v).toLowerCase()));
    case 'answered': return arr.length > 0;
    case 'not_answered': return arr.length === 0;
    case 'gt': return arr.length > 0 && parseFloat(arr[0]) > parseFloat(v);
    case 'lt': return arr.length > 0 && parseFloat(arr[0]) < parseFloat(v);
    default: return false;
  }
}

function sat(r, eff) {
  if (!r.conds || !r.conds.length) return false;
  return r.logic === 'OR' ? r.conds.some(c => testCond(c, eff)) : r.conds.every(c => testCond(c, eff));
}

function computeVisibleQuestions(def, answers) {
  const qs = Array.isArray(def.questions) ? def.questions : [];
  const rules = Array.isArray(def.rules) ? def.rules : [];
  const vis = [], eff = {};
  let ended = false;
  const idx = id => qs.findIndex(q => q.id === id);

  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    for (const r of rules) {
      if ((r.action === 'end' || r.action === 'redirect') && sat(r, eff) && Math.max(...r.conds.map(c => idx(c.qid))) < i) {
        ended = true;
        break;
      }
    }
    if (ended) break;

    let v = true;
    const shows = rules.filter(r => r.action === 'show' && r.target === q.id);
    if (shows.length) {
      v = shows.some(r => sat(r, eff));
    }
    if (v && rules.some(r => r.action === 'hide' && r.target === q.id && sat(r, eff))) v = false;
    if (v && rules.some(r => r.action === 'skipSection' && r.target === q.sectionId && sat(r, eff))) v = false;

    if (v) {
      vis.push(q);
      if (answers[q.id] !== undefined) eff[q.id] = answers[q.id];
    }
  }

  return vis;
}

function validateSurveySubmission(def, submittedAnswers) {
  if (!submittedAnswers || typeof submittedAnswers !== 'object' || Array.isArray(submittedAnswers)) {
    throw new HttpError(400, 'validation', 'Answers must be a JSON object.');
  }

  const allQuestions = Array.isArray(def.questions) ? def.questions : [];
  const qMap = new Map(allQuestions.map(q => [q.id, q]));

  // 1. Drop unknown keys and clean answers
  const sanitized = {};
  for (const [k, v] of Object.entries(submittedAnswers)) {
    if (!qMap.has(k)) continue;
    if (v !== null && v !== undefined && v !== '') {
      sanitized[k] = v;
    }
  }

  // 2. Compute which questions are visible based on skip & branching logic
  const visibleQuestions = computeVisibleQuestions(def, sanitized);
  const visibleSet = new Set(visibleQuestions.map(q => q.id));

  // Remove answers for questions that were hidden by logic
  for (const k of Object.keys(sanitized)) {
    if (!visibleSet.has(k)) delete sanitized[k];
  }

  // 3. Validate each visible question
  for (const q of visibleQuestions) {
    const val = sanitized[q.id];
    const isAnswered = val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0);

    // Check required
    if (q.required && !isAnswered) {
      throw new HttpError(400, 'validation', `Question "${q.text || q.id}" is required.`);
    }

    if (!isAnswered) continue;

    // Check option membership
    const type = q.type || 'Text';
    const opts = (Array.isArray(q.options) ? q.options : []).map(o => (typeof o === 'object' ? (o.text || o.id) : String(o)));

    if (['Single Choice', 'Image Choice', 'Dropdown'].includes(type)) {
      if (opts.length > 0 && !opts.some(o => o === val || o.toLowerCase() === String(val).toLowerCase())) {
        throw new HttpError(400, 'validation', `Invalid selection for question "${q.text || q.id}".`);
      }
    } else if (type === 'Yes / No') {
      const v = String(val).trim().toLowerCase();
      if (!['yes', 'no'].includes(v)) {
        throw new HttpError(400, 'validation', `Please answer Yes or No for "${q.text || q.id}".`);
      }
    } else if (['Multiple Choice', 'Ranking'].includes(type)) {
      if (!Array.isArray(val)) {
        throw new HttpError(400, 'validation', `Question "${q.text || q.id}" expects an array of choices.`);
      }
      if (opts.length > 0) {
        for (const item of val) {
          if (!opts.some(o => o === item || o.toLowerCase() === String(item).toLowerCase())) {
            throw new HttpError(400, 'validation', `Invalid option "${item}" in "${q.text || q.id}".`);
          }
        }
      }
    } else if (['Rating', 'Star Rating', 'Scale / Likert'].includes(type)) {
      const num = Number(val);
      const max = q.scaleMax || 5;
      if (isNaN(num) || num < 1 || num > max) {
        throw new HttpError(400, 'validation', `Rating for "${q.text || q.id}" must be between 1 and ${max}.`);
      }
    } else if (type === 'Email') {
      if (!/^\S+@\S+\.\S+$/.test(String(val))) {
        throw new HttpError(400, 'validation', `Please enter a valid email for "${q.text || q.id}".`);
      }
    } else if (type === 'Phone') {
      if (!/^[+\d][\d\s-]{6,}$/.test(String(val))) {
        throw new HttpError(400, 'validation', `Please enter a valid phone number for "${q.text || q.id}".`);
      }
    } else if (type === 'Lead Capture') {
      const o = typeof val === 'object' ? val : {};
      if (q.required && !(o.name && (o.mobile || o.email))) {
        throw new HttpError(400, 'validation', `Please enter name and contact info for "${q.text || q.id}".`);
      }
      if ((o.name || o.mobile || o.email) && !o.consent) {
        throw new HttpError(400, 'validation', `Consent is required for lead contact.`);
      }
    }
  }

  return sanitized;
}

module.exports = { validateSurveySubmission, computeVisibleQuestions };
