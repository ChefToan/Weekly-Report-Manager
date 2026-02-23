import winston from 'winston';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: logFormat,
  defaultMeta: { service: 'weekly-report-app' },
  transports: [
    // File transport for production (PM2 will handle file rotation)
    ...(isProduction ? [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 10
      })
    ] : []),
    
    // Console transport for development
    ...(isDevelopment ? [
      new winston.transports.Console({
        format: consoleFormat
      })
    ] : [])
  ]
});

// Export convenience methods
export const log = {
  error: (message: string, meta?: object) => logger.error(message, meta),
  warn: (message: string, meta?: object) => logger.warn(message, meta),
  info: (message: string, meta?: object) => logger.info(message, meta),
  debug: (message: string, meta?: object) => logger.debug(message, meta),
};

export default logger;