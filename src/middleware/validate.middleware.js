// Validate req.body / req.params / req.query against Zod schemas.
// Parsed (trimmed, stripped of unknown keys) values replace the originals in
// req.validated so controllers never touch raw input.
const validate = (schemas) => (req, res, next) => {
  req.validated = {};
  for (const part of ['params', 'query', 'body']) {
    const schema = schemas[part];
    if (!schema) continue;

    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.join('.');
      return res.status(400).json({
        error: field ? `${field}: ${issue.message}` : issue.message,
        details: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    req.validated[part] = result.data;
  }
  next();
};

module.exports = { validate };
