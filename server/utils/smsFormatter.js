'use strict';

const crypto = require('crypto');

/*  Single source of truth for Custom SMS bodies.
    The preview endpoint and every send path call formatCustomSms, so what the
    operator sees is byte-for-byte what the handset receives.

    Deliberately adds no greeting in English, no brand signature and no
    financial content — the operator's own text is the message.              */

// Only these placeholders are ever substituted. Anything else is left as
// written rather than evaluated, so a template can never execute anything.
const SUPPORTED_VARIABLES = ['name', 'event'];

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/** Lists the unsupported {{variables}} found in a template. */
function findUnsupportedVariables(text) {
  const found = new Set();
  String(text || '').replace(VARIABLE_PATTERN, (_, key) => {
    if (!SUPPORTED_VARIABLES.includes(key.toLowerCase())) found.add(key);
    return '';
  });
  return [...found];
}

/** Substitutes only the supported variables; unknown ones are left verbatim. */
function resolveVariables(text, { name, event }) {
  const values = { name: String(name || '').trim(), event: String(event || '').trim() };
  return String(text || '').replace(VARIABLE_PATTERN, (match, key) => {
    const k = key.toLowerCase();
    return SUPPORTED_VARIABLES.includes(k) ? values[k] : match;
  });
}

/*  Whitespace clean-up for the handset:
      - CRLF/CR      -> LF
      - runs of spaces/tabs inside a line collapse to one space
      - leading and trailing whitespace stripped per line
      - 3+ newlines  -> at most one blank line
      - whole message trimmed
    Word spacing and Swahili punctuation are untouched.                      */
function normalizeSms(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Builds the final Custom SMS body in the fixed three-part order:
 *
 *   line 1  EVENT NAME   (uppercased)
 *   line 2  MEMBER NAME  (uppercased)
 *   line 3+ the operator's message, unchanged apart from whitespace tidy-up
 *
 * No greeting and no signature are ever added. A missing event or name simply
 * drops that line rather than leaving a blank one.
 *
 * @returns {string} the exact SMS body
 */
function formatCustomSms({ name, event, message }) {
  // Variables inside the body keep their natural case — only the two header
  // lines are uppercased.
  const resolved = resolveVariables(message, { name, event });

  const lines = [];
  const ev  = String(event || '').trim();
  const who = String(name  || '').trim();

  if (ev)  lines.push(ev.toUpperCase());
  if (who) lines.push(who.toUpperCase());

  const body = normalizeSms(resolved);
  if (body) lines.push(body);

  return normalizeSms(lines.join('\n'));
}

/*  Deterministic identity for a Send-to-All campaign.

    Built from the sender, the saved template (when one is used) or the
    normalised message text, and the event. The same template + event sent
    again yields the same key, so previously-contacted members are skipped;
    a different template or event yields a different key, so those members
    become eligible again.                                                   */
function buildCampaignKey({ userId, templateId, message, eventId }) {
  const basis = templateId
    ? `u:${userId}|t:${templateId}|e:${eventId || ''}`
    : `u:${userId}|m:${normalizeSms(message)}|e:${eventId || ''}`;
  return crypto.createHash('sha256').update(basis).digest('hex').slice(0, 64);
}

module.exports = {
  SUPPORTED_VARIABLES,
  findUnsupportedVariables,
  resolveVariables,
  normalizeSms,
  formatCustomSms,
  buildCampaignKey,
};
