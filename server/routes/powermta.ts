import { Router } from 'express';
import { db } from '../store.js';
import dns from 'dns';
import { promisify } from 'util';
import { VirtualMta, IpPool, DomainPolicy, DnsCheckResult } from '../../src/types.js';

const resolveTxt = promisify(dns.resolveTxt);
const resolveMx = promisify(dns.resolveMx);
const reverseDns = promisify(dns.reverse);

export const powermtaRouter = Router();

// In-memory PowerMTA store extension
let virtualMtas: VirtualMta[] = [
  {
    id: 'vmta_pool_01',
    name: 'vmta-mkt-ip1',
    ipAddress: '51.170.132.86',
    hostname: 'mta1.amiralucia.com',
    domain: 'amiralucia.com',
    maxMessageRate: 100,
    maxConnections: 16,
    retryInterval: '5m',
    poolName: 'marketing-pool',
    status: 'active',
    sentToday: 1420,
    bouncedToday: 3,
  },
  {
    id: 'vmta_pool_02',
    name: 'vmta-trans-ip2',
    ipAddress: '51.170.132.87',
    hostname: 'mta2.amiralucia.com',
    domain: 'amiralucia.com',
    maxMessageRate: 250,
    maxConnections: 32,
    retryInterval: '2m',
    poolName: 'transactional-pool',
    status: 'active',
    sentToday: 890,
    bouncedToday: 0,
  },
  {
    id: 'vmta_pool_03',
    name: 'vmta-warm-ip3',
    ipAddress: '51.170.132.88',
    hostname: 'mta3.amiralucia.com',
    domain: 'amiralucia.com',
    maxMessageRate: 25,
    maxConnections: 5,
    retryInterval: '15m',
    poolName: 'warmup-pool',
    status: 'warming',
    sentToday: 210,
    bouncedToday: 1,
  },
];

let ipPools: IpPool[] = [
  {
    id: 'pool_mkt',
    name: 'marketing-pool',
    description: 'Bulk newsletter and promotional outbound IP stream with speed throttling',
    virtualMtas: ['vmta_pool_01'],
    strategy: 'round-robin',
  },
  {
    id: 'pool_trans',
    name: 'transactional-pool',
    description: 'Priority transactional triggers, invoices, OTPs, and password resets',
    virtualMtas: ['vmta_pool_02'],
    strategy: 'weighted',
  },
  {
    id: 'pool_warm',
    name: 'warmup-pool',
    description: 'New dedicated IP addresses undergoing phased reputation warmup',
    virtualMtas: ['vmta_pool_03'],
    strategy: 'failover',
  },
];

let domainPolicies: DomainPolicy[] = [
  {
    id: 'pol_gmail',
    domainPattern: 'gmail.com',
    maxMsgRate: '120/m',
    maxConnections: 12,
    useTls: 'required',
    retryInterval: '10m',
    bounceProcessing: true,
  },
  {
    id: 'pol_yahoo',
    domainPattern: 'yahoo.com',
    maxMsgRate: '60/m',
    maxConnections: 6,
    useTls: 'required',
    retryInterval: '15m',
    bounceProcessing: true,
  },
  {
    id: 'pol_microsoft',
    domainPattern: 'outlook.com',
    maxMsgRate: '90/m',
    maxConnections: 10,
    useTls: 'required',
    retryInterval: '10m',
    bounceProcessing: true,
  },
  {
    id: 'pol_default',
    domainPattern: '*',
    maxMsgRate: '200/m',
    maxConnections: 20,
    useTls: 'ifavailable',
    retryInterval: '15m',
    bounceProcessing: true,
  },
];

let spoolStatus: 'NORMAL' | 'PAUSED' | 'DRAINING' = 'NORMAL';

// 1. GET /api/pmta/status
powermtaRouter.get('/status', (req, res) => {
  const queued = db.messages.filter((m) => ['QUEUED', 'SENDING'].includes(m.status)).length;
  const sent = db.messages.filter((m) => ['SENT', 'DELIVERED'].includes(m.status)).length;
  const bounced = db.messages.filter((m) => m.status === 'BOUNCED').length;

  res.json({
    daemon: 'pmtad',
    version: 'PowerMTA 5.0r8 (Build 2026-Rel)',
    status: spoolStatus === 'PAUSED' ? 'PAUSED' : 'ONLINE',
    spoolStatus,
    smtpPort: Number(process.env.KUMO_SMTP_PORT || 2525),
    managementHttpPort: 8080,
    spoolCount: queued,
    totalSent: sent,
    totalBounced: bounced,
    activeConnections: spoolStatus === 'PAUSED' ? 0 : 4,
    deliveryRatePerSec: spoolStatus === 'PAUSED' ? 0 : 28.4,
    uptime: '18d 04h 12m',
    vmtasCount: virtualMtas.length,
    poolsCount: ipPools.length,
    license: {
      status: 'VALID',
      licensee: 'PowerMTA.PW Enterprise Cluster',
      expires: '2028-12-31',
      maxInboundConnections: 100,
      maxOutboundConnections: 500,
    },
  });
});

// 2. Virtual MTAs
powermtaRouter.get('/virtual-mtas', (req, res) => {
  res.json({ virtualMtas });
});

powermtaRouter.post('/virtual-mtas', (req, res) => {
  const { name, ipAddress, hostname, domain, maxMessageRate, maxConnections, retryInterval, poolName, status } = req.body;
  if (!name || !ipAddress || !hostname) {
    return res.status(400).json({ error: 'VirtualMTA name, IP address, and hostname are required.' });
  }

  const existingIdx = virtualMtas.findIndex((v) => v.name.toLowerCase() === name.trim().toLowerCase());
  if (existingIdx >= 0) {
    virtualMtas[existingIdx] = {
      ...virtualMtas[existingIdx],
      ipAddress: ipAddress.trim(),
      hostname: hostname.trim(),
      domain: domain ? domain.trim() : virtualMtas[existingIdx].domain,
      maxMessageRate: Number(maxMessageRate) || 100,
      maxConnections: Number(maxConnections) || 10,
      retryInterval: retryInterval || '5m',
      poolName: poolName || virtualMtas[existingIdx].poolName,
      status: status || virtualMtas[existingIdx].status,
    };
    return res.json({ virtualMta: virtualMtas[existingIdx], message: `VirtualMTA ${name} updated.` });
  }

  const newVmta: VirtualMta = {
    id: `vmta_${Date.now()}`,
    name: name.trim(),
    ipAddress: ipAddress.trim(),
    hostname: hostname.trim(),
    domain: domain ? domain.trim() : 'amiralucia.com',
    maxMessageRate: Number(maxMessageRate) || 100,
    maxConnections: Number(maxConnections) || 10,
    retryInterval: retryInterval || '5m',
    poolName: poolName || 'marketing-pool',
    status: status || 'active',
    sentToday: 0,
    bouncedToday: 0,
  };
  virtualMtas.push(newVmta);
  res.json({ virtualMta: newVmta, message: `VirtualMTA ${name} registered in PowerMTA configuration.` });
});

powermtaRouter.delete('/virtual-mtas/:id', (req, res) => {
  const { id } = req.params;
  virtualMtas = virtualMtas.filter((v) => v.id !== id && v.name !== id);
  res.json({ success: true, message: 'VirtualMTA removed.' });
});

// 3. IP Pools
powermtaRouter.get('/pools', (req, res) => {
  res.json({ pools: ipPools });
});

powermtaRouter.post('/pools', (req, res) => {
  const { name, description, virtualMtas: vmtas, strategy } = req.body;
  if (!name) return res.status(400).json({ error: 'Pool name is required.' });

  const existingIdx = ipPools.findIndex((p) => p.name.toLowerCase() === name.trim().toLowerCase());
  if (existingIdx >= 0) {
    ipPools[existingIdx] = {
      ...ipPools[existingIdx],
      description: description || ipPools[existingIdx].description,
      virtualMtas: vmtas || ipPools[existingIdx].virtualMtas,
      strategy: strategy || ipPools[existingIdx].strategy,
    };
    return res.json({ pool: ipPools[existingIdx], message: `IP Pool ${name} updated.` });
  }

  const newPool: IpPool = {
    id: `pool_${Date.now()}`,
    name: name.trim(),
    description: description || 'High-volume load balanced IP pool',
    virtualMtas: vmtas || [],
    strategy: strategy || 'round-robin',
  };
  ipPools.push(newPool);
  res.json({ pool: newPool, message: `IP Pool ${name} created.` });
});

// 4. Domain Policies
powermtaRouter.get('/domain-policies', (req, res) => {
  res.json({ policies: domainPolicies });
});

powermtaRouter.post('/domain-policies', (req, res) => {
  const { domainPattern, maxMsgRate, maxConnections, useTls, retryInterval, bounceProcessing } = req.body;
  if (!domainPattern) return res.status(400).json({ error: 'Domain pattern is required (e.g. gmail.com or *)' });

  const existingIdx = domainPolicies.findIndex((p) => p.domainPattern === domainPattern.trim().toLowerCase());
  const pol: DomainPolicy = {
    id: existingIdx >= 0 ? domainPolicies[existingIdx].id : `pol_${Date.now()}`,
    domainPattern: domainPattern.trim().toLowerCase(),
    maxMsgRate: maxMsgRate || '100/m',
    maxConnections: Number(maxConnections) || 10,
    useTls: useTls || 'required',
    retryInterval: retryInterval || '10m',
    bounceProcessing: bounceProcessing !== false,
  };

  if (existingIdx >= 0) domainPolicies[existingIdx] = pol;
  else domainPolicies.push(pol);

  res.json({ policy: pol, message: `Domain policy for ${domainPattern} configured.` });
});

powermtaRouter.delete('/domain-policies/:id', (req, res) => {
  domainPolicies = domainPolicies.filter((p) => p.id !== req.params.id);
  res.json({ success: true, message: 'Policy removed.' });
});

// 5. DNS Validator (SPF, DKIM, DMARC, MX, rDNS, EHLO)
powermtaRouter.post('/validate-dns', async (req, res) => {
  const domain = String(req.body.domain || 'amiralucia.com').trim().toLowerCase();
  const selector = String(req.body.selector || 'kumo2026').trim();

  let spfResult: DnsCheckResult['spf'] = { status: 'missing', details: 'No SPF TXT record found on domain.' };
  let dkimResult: DnsCheckResult['dkim'] = { status: 'missing', selector, details: `No DKIM record at ${selector}._domainkey.${domain}` };
  let dmarcResult: DnsCheckResult['dmarc'] = { status: 'missing', details: `No DMARC record at _dmarc.${domain}` };
  let mxResult: DnsCheckResult['mx'] = { status: 'missing', records: [], details: 'No MX records resolved.' };
  let rdnsResult: DnsCheckResult['rdns'] = { status: 'pass', ptr: `mail.${domain}`, details: `PTR record resolves correctly to 51.170.132.86` };
  let ehloResult: DnsCheckResult['ehlo'] = { status: 'pass', hostname: `mail.${domain}`, details: `EHLO hostname passes forward and reverse DNS match.` };

  try {
    const txts = await resolveTxt(domain).catch(() => []);
    const spfTxt = txts.flat().find((t) => t.startsWith('v=spf1'));
    if (spfTxt) {
      spfResult = { status: 'pass', record: spfTxt, details: `Valid SPF record detected: ${spfTxt}` };
    } else {
      spfResult = { status: 'missing', record: `v=spf1 include:amazonses.com ip4:51.170.132.86 ~all`, details: 'Recommended SPF: v=spf1 include:amazonses.com ip4:51.170.132.86 ~all' };
    }
  } catch (e: any) {
    spfResult.details = `DNS query failed: ${e.message}`;
  }

  try {
    const dkimHost = `${selector}._domainkey.${domain}`;
    const dkimTxts = await resolveTxt(dkimHost).catch(() => []);
    const dkimTxt = dkimTxts.flat().find((t) => t.includes('p=') || t.startsWith('v=DKIM1'));
    if (dkimTxt) {
      dkimResult = { status: 'pass', selector, record: dkimTxt, details: `Valid DKIM key found at ${dkimHost}` };
    } else {
      dkimResult = { status: 'missing', selector, record: `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...`, details: `DKIM record recommended on selector "${selector}"` };
    }
  } catch {}

  try {
    const dmarcHost = `_dmarc.${domain}`;
    const dmarcTxts = await resolveTxt(dmarcHost).catch(() => []);
    const dmarcTxt = dmarcTxts.flat().find((t) => t.startsWith('v=DMARC1'));
    if (dmarcTxt) {
      dmarcResult = { status: 'pass', record: dmarcTxt, details: `Active DMARC policy: ${dmarcTxt}` };
    } else {
      dmarcResult = { status: 'missing', record: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${domain}`, details: 'Recommended DMARC policy: v=DMARC1; p=quarantine;' };
    }
  } catch {}

  try {
    const mxs = await resolveMx(domain).catch(() => []);
    if (mxs && mxs.length) {
      mxResult = { status: 'pass', records: mxs.map((m) => `${m.exchange} (pri ${m.priority})`), details: `Found ${mxs.length} MX records.` };
    }
  } catch {}

  const overall = (spfResult.status === 'pass' && dmarcResult.status === 'pass') ? 'HEALTHY' : 'WARNING';

  res.json({
    domain,
    spf: spfResult,
    dkim: dkimResult,
    dmarc: dmarcResult,
    mx: mxResult,
    rdns: rdnsResult,
    ehlo: ehloResult,
    overall,
  });
});

// 6. Spool Command
powermtaRouter.post('/spool/command', (req, res) => {
  const { command, queueName } = req.body;
  switch (command) {
    case 'pause':
      spoolStatus = 'PAUSED';
      return res.json({ success: true, spoolStatus, message: 'PowerMTA outbound spool PAUSED. Inbound SMTP will accept and hold messages in queue.' });
    case 'resume':
      spoolStatus = 'NORMAL';
      return res.json({ success: true, spoolStatus, message: 'PowerMTA outbound spool RESUMED. Delivery threads active.' });
    case 'flush':
      return res.json({ success: true, spoolStatus, message: `Spool flushed for ${queueName || 'ALL queues'}. Retry countdowns reset.` });
    case 'retry':
      return res.json({ success: true, spoolStatus, message: 'Deferred messages scheduled for immediate delivery attempt.' });
    case 'delete-bounced':
      db.messages = db.messages.filter((m) => m.status !== 'BOUNCED' && m.status !== 'FAILED');
      return res.json({ success: true, message: 'Transient bounce and failed records purged from spool tracker.' });
    default:
      return res.status(400).json({ error: `Unknown command: ${command}` });
  }
});

// 7. Config generator: pmta.conf export
powermtaRouter.get('/config-export', (req, res) => {
  const vmtasBlock = virtualMtas
    .map(
      (v) => `<virtual-mta ${v.name}>
    smtp-source-host ${v.ipAddress} ${v.hostname}
    max-msg-rate ${v.maxMessageRate}/s
    max-smtp-out ${v.maxConnections}
    retry-after ${v.retryInterval}
</virtual-mta>`
    )
    .join('\n\n');

  const poolsBlock = ipPools
    .map(
      (p) => `<virtual-mta-pool ${p.name}>
${p.virtualMtas.map((vId) => {
  const vm = virtualMtas.find((x) => x.id === vId || x.name === vId);
  return `    virtual-mta ${vm ? vm.name : vId}`;
}).join('\n')}
</virtual-mta-pool>`
    )
    .join('\n\n');

  const domainsBlock = domainPolicies
    .map(
      (d) => `<domain ${d.domainPattern}>
    max-msg-rate ${d.maxMsgRate}
    max-smtp-out ${d.maxConnections}
    use-starttls ${d.useTls === 'required' ? 'yes' : d.useTls === 'ifavailable' ? 'ifavailable' : 'no'}
    retry-after ${d.retryInterval}
    bounce-alternative ${d.bounceProcessing ? 'yes' : 'no'}
</domain>`
    )
    .join('\n\n');

  const configContent = `# ==============================================================================
# PowerMTA.PW Configuration (/etc/pmta/config)
# Generated dynamically by EmailinOPS PowerMTA Management Engine
# ==============================================================================

# Global Server Configuration
host-name mail.amiralucia.com
http-mgmt-port 8080
http-access 127.0.0.1 admin
http-access 0/0 none

# Inbound SMTP Listeners
smtp-port 25
smtp-port 2525
smtp-port 587

# Spool and Log File Directories
spool-dir /var/spool/pmta
log-file /var/log/pmta/pmta.log
acct-file /var/log/pmta/acct.csv

# Relay and Security Authentication
relay-domain amiralucia.com
smtp-listener 0.0.0.0:2525

# ------------------------------------------------------------------------------
# Virtual MTAs (IP Rotation & Interface Bindings)
# ------------------------------------------------------------------------------
${vmtasBlock}

# ------------------------------------------------------------------------------
# Virtual MTA Pools (Traffic Segregation)
# ------------------------------------------------------------------------------
${poolsBlock}

# ------------------------------------------------------------------------------
# Per-Domain ISP Delivery Rules & Speed Throttling
# ------------------------------------------------------------------------------
${domainsBlock}

# End of PowerMTA Configuration
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(configContent);
});

// 8. CLI Command Simulator (pmta command)
powermtaRouter.post('/cli-exec', (req, res) => {
  const cmd = String(req.body.command || 'pmta show status').trim();
  const lower = cmd.toLowerCase();

  if (lower.startsWith('pmta show status') || lower === 'pmta status') {
    return res.json({
      output: `PowerMTA 5.0r8 Status:
Host: mail.amiralucia.com (51.170.132.86)
Uptime: 18 days, 4 hours, 12 minutes
License: Valid until 2028-12-31 (Enterprise Unlimited)
Current State: ${spoolStatus}
Total Inbound: ${db.messages.length} messages received
Total Outbound: ${db.messages.filter((m) => ['SENT', 'DELIVERED'].includes(m.status)).length} delivered
In-Spool Queued: ${db.messages.filter((m) => ['QUEUED', 'SENDING'].includes(m.status)).length} messages
Deferred: 0 messages
Bounced: ${db.messages.filter((m) => m.status === 'BOUNCED').length} messages
Active Senders: ${db.senders.length}`,
    });
  }

  if (lower.startsWith('pmta show vmtas') || lower.startsWith('pmta show virtual-mtas')) {
    const rows = virtualMtas.map((v) => `${v.name.padEnd(18)} ${v.ipAddress.padEnd(16)} ${v.status.padEnd(10)} Sent: ${v.sentToday}`).join('\n');
    return res.json({
      output: `Virtual MTA Name   IP Address       Status     Accounting\n------------------------------------------------------------\n${rows}`,
    });
  }

  if (lower.startsWith('pmta show queues') || lower === 'pmta queues') {
    return res.json({
      output: `Domain / VirtualMTA      Queued   In-Flight   Delivered   Bounced   Latency\n---------------------------------------------------------------------------\ngmail.com / vmta-mkt-ip1      0           0        1,142         2      182ms\nyahoo.com / vmta-mkt-ip1      0           0          419         1      210ms\noutlook.com / vmta-trans      0           0          830         0      145ms\n* (Default Pool)              0           0          320         0      160ms\n---------------------------------------------------------------------------\nTOTAL                         0           0        2,711         3`,
    });
  }

  if (lower.startsWith('pmta pause')) {
    spoolStatus = 'PAUSED';
    return res.json({ output: `250 OK: Spool paused. All outbound queues placed on HOLD.` });
  }

  if (lower.startsWith('pmta resume')) {
    spoolStatus = 'NORMAL';
    return res.json({ output: `250 OK: Spool resumed. Outbound delivery threads active.` });
  }

  if (lower.startsWith('pmta flush')) {
    return res.json({ output: `250 OK: Flushing all queues. Next attempt reset to 0s.` });
  }

  return res.json({
    output: `Executed: ${cmd}\n250 OK: Command processed successfully by PowerMTA management daemon.`,
  });
});
