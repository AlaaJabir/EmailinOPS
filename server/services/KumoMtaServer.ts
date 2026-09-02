import net from 'net';

export class KumoMtaServer {
  private server: net.Server | null = null;
  private port: number;
  private host: string;
  private isRunning: boolean = false;

  constructor(port = 2525, host = '0.0.0.0') {
    this.port = port;
    this.host = host;
  }

  public start(): Promise<boolean> {
    return new Promise((resolve) => {
      this.server = net.createServer((socket) => {
        let inData = false;
        let dataBuffer = '';
        let sender = '';
        const recipients: string[] = [];

        socket.setEncoding('utf8');

        // Send initial 220 banner
        socket.write('220 kumo.internal KumoMTA ESMTP service ready\r\n');

        socket.on('data', (chunk: string) => {
          dataBuffer += chunk;

          if (inData) {
            // Check for end of data delimiter (\r\n.\r\n)
            if (dataBuffer.includes('\r\n.\r\n') || dataBuffer.endsWith('\n.\n') || dataBuffer === '.\r\n') {
              inData = false;
              dataBuffer = '';
              const spoolId = `spool_${Date.now().toString(36)}`;
              socket.write(`250 2.0.0 OK: queued in KumoMTA spool id ${spoolId}\r\n`);
            }
            return;
          }

          // Process line by line
          const lines = dataBuffer.split(/\r?\n/);
          // Keep trailing incomplete line in buffer
          dataBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const upper = trimmed.toUpperCase();

            if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
              socket.write(
                '250-kumo.internal KumoMTA\r\n' +
                '250-PIPELINING\r\n' +
                '250-8BITMIME\r\n' +
                '250-SMTPUTF8\r\n' +
                '250-SIZE 52428800\r\n' +
                '250 OK\r\n'
              );
            } else if (upper.startsWith('MAIL FROM:')) {
              sender = trimmed.substring(10).trim();
              socket.write('250 2.1.0 Sender OK\r\n');
            } else if (upper.startsWith('RCPT TO:')) {
              const rcpt = trimmed.substring(8).trim();
              recipients.push(rcpt);
              socket.write('250 2.1.5 Recipient OK\r\n');
            } else if (upper === 'DATA') {
              inData = true;
              dataBuffer = '';
              socket.write('354 Start mail input; end with <CRLF>.<CRLF>\r\n');
            } else if (upper === 'RSET') {
              inData = false;
              dataBuffer = '';
              sender = '';
              recipients.length = 0;
              socket.write('250 2.0.0 OK\r\n');
            } else if (upper === 'NOOP') {
              socket.write('250 2.0.0 OK\r\n');
            } else if (upper === 'QUIT') {
              socket.write('221 2.0.0 kumo.internal Service closing transmission channel\r\n');
              socket.end();
            } else {
              socket.write('502 5.5.2 Command not implemented\r\n');
            }
          }
        });

        socket.on('error', (err) => {
          // Client disconnected or socket error
        });
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`[KumoMTA Listener] Port ${this.port} is already in use (external KumoMTA active).`);
          this.isRunning = true;
          resolve(true);
        } else {
          console.error(`[KumoMTA Listener] Error on ${this.host}:${this.port}:`, err.message);
          resolve(false);
        }
      });

      this.server.listen(this.port, this.host, () => {
        console.log(`[KumoMTA Listener] Listening for SMTP submissions on ${this.host}:${this.port}`);
        this.isRunning = true;
        resolve(true);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export const kumoMtaServer = new KumoMtaServer(
  Number(process.env.KUMO_SMTP_PORT || process.env.KUMOMTA_PORT) || 2525,
  '0.0.0.0'
);
