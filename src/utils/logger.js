const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class Logger {
  constructor() {
    this.logFile = path.join(logsDir, 'app.log');
    this.errorFile = path.join(logsDir, 'error.log');
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaString}\n`;
  }

  writeToFile(filename, message) {
    fs.appendFileSync(filename, message);
  }

  info(message, meta = {}) {
    const formatted = this.formatMessage('info', message, meta);
    console.log(formatted.trim());
    this.writeToFile(this.logFile, formatted);
  }

  error(message, meta = {}) {
    const formatted = this.formatMessage('error', message, meta);
    console.error(formatted.trim());
    this.writeToFile(this.errorFile, formatted);
    this.writeToFile(this.logFile, formatted);
  }

  warn(message, meta = {}) {
    const formatted = this.formatMessage('warn', message, meta);
    console.warn(formatted.trim());
    this.writeToFile(this.logFile, formatted);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      const formatted = this.formatMessage('debug', message, meta);
      console.log(formatted.trim());
      this.writeToFile(this.logFile, formatted);
    }
  }
}

module.exports = new Logger();
