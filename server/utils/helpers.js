'use strict';

/**
 * Format a Date object or date string into 'YYYY-MM-DD'.
 * @param {Date|string} date
 * @returns {string}
 */
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Sanitize a string for use as a filename.
 * Replaces spaces and special characters with underscores, converts to lowercase.
 * @param {string} str
 * @returns {string}
 */
function sanitizeFilename(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

module.exports = { formatDate, sanitizeFilename };
