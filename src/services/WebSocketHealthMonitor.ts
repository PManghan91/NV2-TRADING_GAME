/**
 * WebSocket Health Monitor
 * Monitors WebSocket connection health and performance metrics
 */

export interface ConnectionMetrics {
  totalConnections: number;
  totalDisconnections: number;
  totalReconnections: number;
  totalMessages: number;
  totalErrors: number;
  averageLatency: number;
  uptime: number;
  lastConnected: number;
  lastDisconnected: number;
}

export class WebSocketHealthMonitor {
  private metrics: ConnectionMetrics = {
    totalConnections: 0,
    totalDisconnections: 0,
    totalReconnections: 0,
    totalMessages: 0,
    totalErrors: 0,
    averageLatency: 0,
    uptime: 0,
    lastConnected: 0,
    lastDisconnected: 0,
  };

  private latencyHistory: number[] = [];
  private startTime: number = Date.now();
  private connectionStartTime: number = 0;
  private totalUptime: number = 0;

  /**
   * Record connection event
   */
  public onConnect(): void {
    this.metrics.totalConnections++;
    this.connectionStartTime = Date.now();
    this.metrics.lastConnected = this.connectionStartTime;
    console.log('🔗 WebSocket connected (health monitor)');
  }

  /**
   * Record disconnection event
   */
  public onDisconnect(): void {
    this.metrics.totalDisconnections++;
    this.metrics.lastDisconnected = Date.now();
    
    if (this.connectionStartTime > 0) {
      const sessionDuration = Date.now() - this.connectionStartTime;
      this.totalUptime += sessionDuration;
      this.connectionStartTime = 0;
    }
    
    console.log('🔌 WebSocket disconnected (health monitor)');
  }

  /**
   * Record reconnection event
   */
  public onReconnect(): void {
    this.metrics.totalReconnections++;
    console.log('🔄 WebSocket reconnection (health monitor)');
  }

  /**
   * Record message received
   */
  public onMessage(latency?: number): void {
    this.metrics.totalMessages++;
    
    if (latency !== undefined) {
      this.latencyHistory.push(latency);
      // Keep only last 100 latency measurements
      if (this.latencyHistory.length > 100) {
        this.latencyHistory.shift();
      }
      
      // Update average latency
      this.metrics.averageLatency = 
        this.latencyHistory.reduce((sum, lat) => sum + lat, 0) / this.latencyHistory.length;
    }
  }

  /**
   * Record error event
   */
  public onError(error: Error | string): void {
    this.metrics.totalErrors++;
    console.warn('⚠️ WebSocket error recorded:', error);
  }

  /**
   * Get current metrics
   */
  public getMetrics(): ConnectionMetrics {
    // Calculate current uptime
    let currentUptime = this.totalUptime;
    if (this.connectionStartTime > 0) {
      currentUptime += Date.now() - this.connectionStartTime;
    }
    
    return {
      ...this.metrics,
      uptime: currentUptime,
    };
  }

  /**
   * Get connection health status
   */
  public getHealthStatus(): 'healthy' | 'warning' | 'critical' {
    const metrics = this.getMetrics();
    const totalTime = Date.now() - this.startTime;
    const uptimePercentage = (metrics.uptime / totalTime) * 100;
    const errorRate = metrics.totalErrors / Math.max(1, metrics.totalMessages);
    
    if (uptimePercentage < 70 || errorRate > 0.05) {
      return 'critical';
    } else if (uptimePercentage < 90 || errorRate > 0.01) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * Generate health report
   */
  public getHealthReport(): string {
    const metrics = this.getMetrics();
    const status = this.getHealthStatus();
    const totalTime = Date.now() - this.startTime;
    const uptimePercentage = ((metrics.uptime / totalTime) * 100).toFixed(1);
    
    return `
WebSocket Health Report:
- Status: ${status.toUpperCase()}
- Uptime: ${uptimePercentage}% (${Math.round(metrics.uptime / 1000)}s)
- Connections: ${metrics.totalConnections}
- Disconnections: ${metrics.totalDisconnections}  
- Reconnections: ${metrics.totalReconnections}
- Messages: ${metrics.totalMessages}
- Errors: ${metrics.totalErrors}
- Avg Latency: ${Math.round(metrics.averageLatency)}ms
- Error Rate: ${((metrics.totalErrors / Math.max(1, metrics.totalMessages)) * 100).toFixed(2)}%
    `.trim();
  }

  /**
   * Reset metrics
   */
  public reset(): void {
    this.metrics = {
      totalConnections: 0,
      totalDisconnections: 0,
      totalReconnections: 0,
      totalMessages: 0,
      totalErrors: 0,
      averageLatency: 0,
      uptime: 0,
      lastConnected: 0,
      lastDisconnected: 0,
    };
    
    this.latencyHistory = [];
    this.startTime = Date.now();
    this.connectionStartTime = 0;
    this.totalUptime = 0;
    
    console.log('🔄 WebSocket health metrics reset');
  }
}

// Singleton instance
export const wsHealthMonitor = new WebSocketHealthMonitor();