import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { KumoMtaService, SendEmailPayload } from '../server/services/KumoMtaService.js';
import { db } from '../server/store.js';

describe('KumoMTA Real Integration - Step 1 Suite', () => {

  describe('1. Configuration Validation', () => {
    it('should fail validation when host is empty', () => {
      const service = new KumoMtaService({ host: '', port: 25 });
      const result = service.validateConfig();
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('host is required')));
    });

    it('should fail validation when port is invalid', () => {
      const service = new KumoMtaService({ host: '127.0.0.1', port: -1 });
      const result = service.validateConfig();
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('port must be a valid port number')));

      const service2 = new KumoMtaService({ host: '127.0.0.1', port: 70000 });
      assert.strictEqual(service2.validateConfig().valid, false);
    });

    it('should pass validation when host and port are valid', () => {
      const service = new KumoMtaService({ host: '10.0.0.50', port: 25 });
      const result = service.validateConfig();
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should sanitize config and NEVER expose password in getConfigSanitized', () => {
      const service = new KumoMtaService({
        host: 'mta.acme.internal',
        port: 587,
        username: 'kumo_admin_user',
        password: 'SUPER_SECRET_PASSWORD_123',
      });

      const sanitized = service.getConfigSanitized();
      assert.strictEqual(sanitized.host, 'mta.acme.internal');
      assert.strictEqual(sanitized.port, 587);
      assert.strictEqual(sanitized.hasAuth, true);
      assert.strictEqual(sanitized.username, 'kumo_admin_user');
      assert.strictEqual((sanitized as any).password, undefined);
      assert.strictEqual((sanitized as any).pass, undefined);
    });
  });

  describe('2. Health Check', () => {
    it('should return offline status when unconfigured', async () => {
      const service = new KumoMtaService({ host: '', port: 25 });
      const health = await service.checkHealth();
      assert.strictEqual(health.status, 'offline');
      assert.strictEqual(health.configured, false);
      assert.ok(health.error?.includes('not configured'));
    });

    it('should report healthy when transporter verify succeeds', async () => {
      const service = new KumoMtaService({ host: '127.0.0.1', port: 25 });
      
      // Inject mock successful transporter
      const mockTransporter: any = {
        verify: async () => true,
        sendMail: async () => ({ response: '250 OK' }),
      };
      service.setTransporter(mockTransporter);

      const health = await service.checkHealth();
      assert.strictEqual(health.status, 'healthy');
      assert.strictEqual(health.configured, true);
      assert.ok(typeof health.latencyMs === 'number');
    });

    it('should report offline with error message when transporter verify fails', async () => {
      const service = new KumoMtaService({ host: '127.0.0.1', port: 25 });
      
      // Inject mock failing transporter
      const mockTransporter: any = {
        verify: async () => {
          throw new Error('Connection refused: 127.0.0.1:25');
        },
      };
      service.setTransporter(mockTransporter);

      const health = await service.checkHealth();
      assert.strictEqual(health.status, 'offline');
      assert.strictEqual(health.configured, true);
      assert.ok(health.error?.includes('Connection refused'));
    });
  });

  describe('3. RFC 5322 Message-ID Generation', () => {
    it('should generate valid RFC 5322 formatted Message-ID containing domain', () => {
      const service = new KumoMtaService({ host: '127.0.0.1', port: 25 });
      const msgId = service.generateRfcMessageId('transact.acme-corp.io');

      assert.ok(msgId.startsWith('<kumo.'));
      assert.ok(msgId.endsWith('@transact.acme-corp.io>'));
      assert.match(msgId, /^<kumo\.\d+\.[a-z0-9]+@transact\.acme-corp\.io>$/);
    });
  });

  describe('4. Real Email Submission Path & Status', () => {
    it('should submit email to transporter and mark initial status as QUEUED (not fake DELIVERED)', async () => {
      const service = new KumoMtaService({ host: '127.0.0.1', port: 25 });
      let capturedMailOptions: any = null;

      const mockTransporter: any = {
        sendMail: async (options: any) => {
          capturedMailOptions = options;
          return {
            messageId: options.messageId,
            response: '250 2.0.0 OK: queued in KumoMTA spool id spool_9921',
            accepted: [options.to],
            rejected: [],
          };
        },
      };
      service.setTransporter(mockTransporter);

      const payload: SendEmailPayload = {
        fromName: 'Acme Alerts',
        fromEmail: 'alerts@transact.acme-corp.io',
        to: 'developer@example.com',
        subject: 'System Spool Test',
        htmlBody: '<p>Test message</p>',
        plainText: 'Test message',
      };

      const result = await service.submitEmail(payload);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'QUEUED');
      assert.strictEqual(result.provider, 'KumoMTA');
      assert.ok(result.kumoResponse.includes('250 2.0.0 OK'));
      assert.ok(capturedMailOptions !== null);
      assert.strictEqual(capturedMailOptions.to, 'developer@example.com');
      assert.ok(capturedMailOptions.headers['List-Unsubscribe']);
      assert.ok(capturedMailOptions.headers['X-KumoMTA-Queue']);

      // Check database storage
      const saved = db.messages.find((m) => m.id === result.messageId);
      assert.ok(saved);
      assert.strictEqual(saved?.status, 'QUEUED');
      assert.strictEqual(saved?.fromEmail, 'alerts@transact.acme-corp.io');
    });

    it('should handle SMTP 550 rejection and update status to FAILED', async () => {
      const service = new KumoMtaService({ host: '127.0.0.1', port: 25 });

      const mockTransporter: any = {
        sendMail: async () => {
          const err: any = new Error('550 5.1.1 Recipient address rejected: User unknown');
          err.responseCode = 550;
          throw err;
        },
      };
      service.setTransporter(mockTransporter);

      const payload: SendEmailPayload = {
        fromEmail: 'security@transact.acme-corp.io',
        to: 'nonexistent@invalid-domain.com',
        subject: 'Bounce Test',
      };

      await assert.rejects(async () => {
        await service.submitEmail(payload);
      }, /550 5.1.1 Recipient address rejected/);

      // Check database recorded the failure
      const failedMsg = db.messages.find((m) => m.toEmail === 'nonexistent@invalid-domain.com');
      assert.ok(failedMsg);
      assert.strictEqual(failedMsg?.status, 'FAILED');
      assert.ok(failedMsg?.smtpResponse?.includes('550'));
    });
  });

  describe('5. Security: Zero Password Leaks in Logs', () => {
    it('should never write secrets or passwords to database logs', async () => {
      const secretPassword = 'SUPER_SECRET_KUMO_PASS_881';
      const service = new KumoMtaService({
        host: '127.0.0.1',
        port: 25,
        username: 'admin',
        password: secretPassword,
      });

      const mockTransporter: any = {
        sendMail: async (options: any) => ({
          messageId: options.messageId,
          response: '250 OK: queued in spool',
          accepted: [options.to],
          rejected: [],
        }),
      };
      service.setTransporter(mockTransporter);

      await service.submitEmail({
        fromEmail: 'security@transact.acme-corp.io',
        to: 'audit@example.com',
        subject: 'Security Log Audit',
      });

      // Verify that no log in db.logs contains secretPassword
      for (const log of db.logs) {
        const strLog = JSON.stringify(log);
        assert.strictEqual(
          strLog.includes(secretPassword),
          false,
          `Password leak found in log entry: ${strLog}`
        );
      }
    });
  });

  describe('6. Production Send Path Has No Mock Logic', () => {
    it('should NOT determine delivery status based on "bounce" or "fail" in recipient email when using real transporter', async () => {
      const service = new KumoMtaService({ host: '127.0.0.1', port: 25 });

      let sendMailInvoked = false;
      const mockTransporter: any = {
        sendMail: async (options: any) => {
          sendMailInvoked = true;
          return {
            messageId: options.messageId,
            response: '250 OK: accepted into KumoMTA spool',
            accepted: [options.to],
            rejected: [],
          };
        },
      };
      service.setTransporter(mockTransporter);

      // Even if toEmail contains "bounce", real submission goes through transporter
      const result = await service.submitEmail({
        fromEmail: 'security@transact.acme-corp.io',
        to: 'user-bounce-testing@example.com',
        subject: 'Real Submission Test',
      });

      assert.strictEqual(sendMailInvoked, true);
      assert.strictEqual(result.status, 'QUEUED');
      assert.strictEqual(result.success, true);
    });
  });
});
