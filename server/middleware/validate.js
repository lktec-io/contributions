/**
 * Request body validation middleware factory.
 * @param {string[]} requiredFields - List of field names that must be present and non-empty in req.body
 * @returns {Function} Express middleware
 */
function validateBody(requiredFields) {
  return function (req, res, next) {
    const errors = [];

    for (const field of requiredFields) {
      const value = req.body[field];
      if (value === undefined || value === null || value === '') {
        errors.push({ field, message: `${field} is required` });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    next();
  };
}

module.exports = { validateBody };
