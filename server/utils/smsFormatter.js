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
 * Builds the final Custom SMS body in the fixed order:
 *
 *   line 1  EVENT NAME        (uppercased)
 *   line 2  HABARI NAME,      (uppercased)
 *   blank
 *   line 4+ the operator's message, unchanged apart from whitespace tidy-up
 *
 * HABARI is the only greeting ever added, and no signature is appended.
 * A missing event or name drops that line rather than leaving a blank one.
 *
 * @returns {string} the exact SMS body
 */
function formatCustomSms({ name, event, message }) {
  // Variables inside the body keep their natural case — only the two header
  // lines are uppercased.
  const resolved = resolveVariables(message, { name, event });

  const ev   = String(event || '').trim();
  const who  = String(name  || '').trim();
  const body = normalizeSms(resolved);

  const head = [];
  if (ev)  head.push(ev.toUpperCase());
  if (who) head.push(`HABARI ${who.toUpperCase()},`);

  if (!head.length) return body;
  if (!body) return normalizeSms(head.join('\n'));

  // One blank line separates the header block from the operator's message.
  return normalizeSms(`${head.join('\n')}\n\n${body}`);
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

/*  ── SMS length and segment counting ────────────────────────────
    Single source of truth for "how many SMS will this cost?".

    Beem is called with encoding 0 (GSM-7), where one segment holds 160
    characters. A message containing anything outside the GSM 03.38 alphabet
    is carried as UCS-2 instead, where a segment holds only 70 — so the count
    reflects the encoding the text actually forces.                          */

const CUSTOM_SMS_SINGLE_LIMIT = 160;   // the product rule: keep Custom SMS to one SMS

const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?'
  + '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
// Each of these costs two GSM-7 characters (escape + char).
const GSM7_EXTENDED = '^{}\\[~]|€';

const GSM7_LIMITS = { single: 160, multi: 153 };
const UCS2_LIMITS = { single: 70,  multi: 67  };

/**
 * Measures a fully rendered SMS body.
 * @returns {{chars:number, segments:number, encoding:'GSM-7'|'UCS-2',
 *            limit:number, withinSingle:boolean}}
 *          `chars` is billable length (GSM-7 extended characters count as 2).
 */
function measureSms(text) {
  const s = String(text || '');

  let gsm = true;
  let chars = 0;
  for (const ch of s) {
    if (GSM7_BASIC.includes(ch)) { chars += 1; continue; }
    if (GSM7_EXTENDED.includes(ch)) { chars += 2; continue; }
    gsm = false;
    break;
  }

  if (!gsm) {
    // UCS-2 bills per UTF-16 code unit, so astral characters count as 2.
    chars = s.length;
  }

  const limits = gsm ? GSM7_LIMITS : UCS2_LIMITS;
  const segments = chars === 0 ? 0
    : chars <= limits.single ? 1
      : Math.ceil(chars / limits.multi);

  return {
    chars,
    segments,
    encoding: gsm ? 'GSM-7' : 'UCS-2',
    limit: limits.single,
    withinSingle: segments <= 1,
  };
}

/** Renders and measures in one step — what every caller should use. */
function measureCustomSms({ name, event, message }) {
  const body = formatCustomSms({ name, event, message });
  return { body, ...measureSms(body) };
}

module.exports = {
  SUPPORTED_VARIABLES,
  CUSTOM_SMS_SINGLE_LIMIT,
  findUnsupportedVariables,
  resolveVariables,
  normalizeSms,
  formatCustomSms,
  measureSms,
  measureCustomSms,
  buildCampaignKey,
};
