const formatMessage = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  const details = meta ? ` ${meta instanceof Error ? meta.stack : JSON.stringify(meta)}` : '';
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${details}`;
};

const logger = {
  info: (message, meta) => console.info(formatMessage('info', message, meta)),
  warn: (message, meta) => console.warn(formatMessage('warn', message, meta)),
  error: (message, meta) => console.error(formatMessage('error', message, meta)),
};

export { logger };
export default logger;
