import { Router, Request, Response } from 'express';
import { db } from '../store.js';

export const metricsRouter = Router();

interface KumoMetric {
  value?: number | Record<string, number | Record<string, number>>;
  type?: string;
  help?: string;
}

type KumoMetricsJson = Record<string, KumoMetric>;

let previousDelivered = 0;
let previousDeliveredAt = 0;

function sumMetricValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value as Record<string, unknown>).reduce((sum, item) => sum + sumMetricValue(item), 0);
}

function serviceMetricValue(metric: KumoMetric | undefined, service: string): number {
  if (!metric) return 0;
  const value = metric.value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const direct = (value as Record<string, unknown>)[service];
    return typeof direct === 'number' ? direct : 0;
  }
  return typeof value === 'number' ? value : 0;
}

async function fetchKumoMetrics(): Promise<{ live: boolean; source: string; data: Record<string, any> }> {
  const endpoint = (process.env.KUMOMTA_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  const started = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`${endpoint}/metrics.json`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`KumoMTA HTTP ${response.status}`);
    const json = (await response.json()) as KumoMetricsJson;

    const ready = sumMetricValue(json.ready_count?.value);
    const scheduled = sumMetricValue(json.scheduled_count?.value);
    const queueSize = ready + scheduled;
    const inboundConnections = serviceMetricValue(json.connection_count, 'esmtp_listener');
    const outboundConnections = serviceMetricValue(json.connection_count, 'smtp_client');
    const deliveredTotal = sumMetricValue(json.total_messages_delivered?.value);
    const receivedTotal = sumMetricValue(json.total_messages_received?.value);
    const failedTotal = sumMetricValue(json.total_messages_fail?.value);
    const transientFailedTotal = sumMetricValue(json.total_messages_transfail?.value);

    const now = Date.now();
    let deliveryRate = 0;
    if (previousDeliveredAt > 0 && now > previousDeliveredAt && deliveredTotal >= previousDelivered) {
      deliveryRate = (deliveredTotal - previousDelivered) / ((now - previousDeliveredAt) / 1000);
    }
    previousDelivered = deliveredTotal;
    previousDeliveredAt = now;

    const diskFreeBytes = sumMetricValue(json.disk_free_bytes?.value);
    const memoryUsage = sumMetricValue(json.memory_usage?.value);
    const cpu = sumMetricValue(json.process_cpu_usage_normalized?.value) || sumMetricValue(json.system_cpu_usage_normalized?.value);

    return {
      live: true,
      source: endpoint,
      data: {
        kumomta_queue_size: queueSize,
        kumomta_ready_queue_size: ready,
        kumomta_scheduled_queue_size: scheduled,
        kumomta_messages_in_flight: outboundConnections,
        kumomta_messages_sent_total: deliveredTotal,
        kumomta_messages_received_total: receivedTotal,
        kumomta_messages_failed_total: failedTotal,
        kumomta_messages_transient_failed_total: transientFailedTotal,
        kumomta_delivery_rate_per_second: Number(deliveryRate.toFixed(3)),
        kumomta_smtp_connection_pool_active: outboundConnections,
        kumomta_smtp_connection_pool_idle: 0,
        kumomta_smtp_connections_in: inboundConnections,
        kumomta_smtp_connections_out: outboundConnections,
        kumomta_memory_usage_bytes: memoryUsage,
        kumomta_cpu_usage_percent: cpu * 100,
        kumomta_disk_free_bytes: diskFreeBytes,
        kumomta_metrics_latency_ms: Date.now() - started,
        kumomta_ready_queue_full: sumMetricValue(json.ready_full?.value),
        kumomta_total_connections: sumMetricValue(json.total_connection_count?.value),
        kumomta_total_connections_denied: sumMetricValue(json.total_connections_denied?.value),
        kumomta_domains_in_queue: json.scheduled_by_domain?.value || {},
        kumomta_queued_by_provider: json.queued_count_by_provider?.value || {},
      },
    };
  } catch (error: any) {
    return {
      live: false,
      source: endpoint,
      data: {
        ...db.getPrometheusMetrics(),
        kumomta_metrics_error: error?.message || 'Unable to reach KumoMTA metrics endpoint',
      },
    };
  }
}

// GET /api/metrics - real KumoMTA telemetry with application fallback
metricsRouter.get('/', async (req: Request, res: Response) => {
  const format = req.query.format || (req.headers.accept?.includes('application/json') ? 'json' : 'text');
  const kumo = await fetchKumoMetrics();
  const data = { ...kumo.data, kumomta_live: kumo.live, kumomta_source: kumo.source };

  if (format === 'json') {
    res.json(data);
    return;
  }

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send([
    '# HELP kumomta_queue_size Current KumoMTA ready + scheduled queue size',
    '# TYPE kumomta_queue_size gauge',
    `kumomta_queue_size ${Number(data.kumomta_queue_size || 0)}`,
    '# HELP kumomta_messages_received_total Total messages received by KumoMTA',
    '# TYPE kumomta_messages_received_total counter',
    `kumomta_messages_received_total ${Number(data.kumomta_messages_received_total || 0)}`,
    '# HELP kumomta_messages_sent_total Total messages delivered by KumoMTA',
    '# TYPE kumomta_messages_sent_total counter',
    `kumomta_messages_sent_total ${Number(data.kumomta_messages_sent_total || 0)}`,
    '# HELP kumomta_delivery_rate_per_second Current delivery rate derived from KumoMTA counter samples',
    '# TYPE kumomta_delivery_rate_per_second gauge',
    `kumomta_delivery_rate_per_second ${Number(data.kumomta_delivery_rate_per_second || 0)}`,
    '# HELP kumomta_smtp_connections_in Active inbound SMTP connections',
    '# TYPE kumomta_smtp_connections_in gauge',
    `kumomta_smtp_connections_in ${Number(data.kumomta_smtp_connections_in || 0)}`,
    '# HELP kumomta_smtp_connections_out Active outbound SMTP connections',
    '# TYPE kumomta_smtp_connections_out gauge',
    `kumomta_smtp_connections_out ${Number(data.kumomta_smtp_connections_out || 0)}`,
    '# HELP kumomta_memory_usage_bytes Current KumoMTA memory usage',
    '# TYPE kumomta_memory_usage_bytes gauge',
    `kumomta_memory_usage_bytes ${Number(data.kumomta_memory_usage_bytes || 0)}`,
    '# HELP kumomta_cpu_usage_percent Current KumoMTA CPU usage',
    '# TYPE kumomta_cpu_usage_percent gauge',
    `kumomta_cpu_usage_percent ${Number(data.kumomta_cpu_usage_percent || 0)}`,
  ].join('\n') + '\n');
});
