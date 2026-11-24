// Central error handler. Any error passed to next(err) lands here.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ error: 'Resource already exists' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ error: err.message || 'Internal server error' });
}

function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

module.exports = { errorHandler, notFound };
