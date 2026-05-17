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
    const { search, eventId, status } = req.query;
    const filter = getIsolationFilter(req);
    const contributors = await Contributor.findAll({ ...filter, search, eventId, status });
    return res.json({ success: true, data: { contributors, total: contributors.length } });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const filter = getIsolationFilter(req);
    const contributor = await Contributor.findById(req.params.id, filter);
    if (!contributor) {
      return res.status(404).json({ success: false, message: 'Contributor not found', errors: [] });
    }
    return res.json({ success: true, data: contributor });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const filter = getIsolationFilter(req);
    // Verify the contributor is accessible to this tenant before deleting
    const contributor = await Contributor.findById(req.params.id, filter);
    if (!contributor) {
      return res.status(404).json({ success: false, message: 'Contributor not found', errors: [] });
    }
    const deleted = await Contributor.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Contributor not found', errors: [] });
    }
    return res.json({ success: true, message: 'Contributor deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { search, getAll, getById, remove };
