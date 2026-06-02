import logger from '@/lib/logger';

/**
 * Circuit Breaker pattern to protect against external service failures.
 */
export default class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 30000; // 30 seconds
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.nextAttempt = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF_OPEN';
        logger.info({ service: this.name }, '[CIRCUIT_BREAKER_HALF_OPEN]');
      } else {
        throw new Error(`Circuit breaker for ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      logger.info({ service: this.name }, '[CIRCUIT_BREAKER_CLOSED]');
    }
  }

  onFailure(error) {
    this.failureCount++;
    logger.warn({ 
      service: this.name, 
      count: this.failureCount,
      error: error.message 
    }, '[CIRCUIT_BREAKER_FAILURE]');

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.recoveryTimeout;
      logger.error({ 
        service: this.name, 
        nextAttempt: new Date(this.nextAttempt).toISOString() 
      }, '[CIRCUIT_BREAKER_OPENED]');
    }
  }
}

// Registry to maintain singleton instances of breakers
const breakers = new Map();

export function getBreaker(name, options) {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker(name, options));
  }
  return breakers.get(name);
}
