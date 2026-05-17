'use strict';

const Contributor = require('../models/Contributor');
const { getIsolationFilter } = require('../utils/tenantHelpers');

async function search(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: [] });

    const filter  = getIsolationFilter(req);
    const results = await Contributor.search(q, filter);
    return res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

async function getAll(req, res, next) {
  try {
    const filter       = getIsolationFilter(req);
    const contributors = await Contributor.findAll(filter);
    return res.json({ success: true, data: { contributors, total: contributors.length } });
  } catch (err) {
    next(err);
  }
}

module.exports = { search, getAll };
