import React, { useState } from 'react';
import { BookOpen, Terminal, CheckCircle2, AlertCircle, Copy, Check, Server, Shield, ExternalLink, HelpCircle } from 'lucide-react';

export const PowerMtaInstallationView: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyCommand = (cmd: string, index: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      title: '1. Server & OS Requirements',
      desc: 'PowerMTA is certified for enterprise Linux environments (AlmaLinux, Rocky Linux, RHEL 8/9, CentOS 7+, and Ubuntu Server 20.04/22.04 LTS).',
      commands: [
        '# Update system dependencies',
        'sudo yum update -y || sudo apt update && sudo apt upgrade -y',
        '# Ensure iptables/firewalld permits port 25, 2525, 587, and 8080',
        'sudo firewall-cmd --zone=public --add-port=25/tcp --permanent',
        'sudo firewall-cmd --zone=public --add-port=2525/tcp --permanent',
        'sudo firewall-cmd --reload',
      ],
    },
    {
      title: '2. Install PowerMTA RPM / DEB Package',
      desc: 'Deploy the official PowerMTA binary package to /usr/sbin/pmta with systemd unit integration.',
      commands: [
        '# For RHEL / CentOS / Rocky Linux (RPM):',
        'sudo rpm -Uvh PowerMTA-5.0r8.rpm',
        '# Verify binary installation and directories',
        'which pmta && ls -la /etc/pmta',
      ],
    },
    {
      title: '3. License Key Activation & Configuration',
      desc: 'Place your valid PowerMTA license key in /etc/pmta/license and copy your generated configuration file.',
      commands: [
        '# Copy your license file',
        'sudo cp license /etc/pmta/license',
        'sudo chmod 640 /etc/pmta/license',
        '# Copy your generated config from the "Server & Config" tab',
        'sudo cp pmta.conf /etc/pmta/config',
        'sudo chown -R pmta:pmta /etc/pmta /var/spool/pmta /var/log/pmta',
      ],
    },
    {
      title: '4. Start & Enable PowerMTA Service',
      desc: 'Start the PowerMTA daemon and enable automatic startup on boot.',
      commands: [
        '# Start PMTA daemon',
        'sudo systemctl start pmta',
        'sudo systemctl enable pmta',
        '# Verify service status',
        'sudo systemctl status pmta',
        '# Check listening ports',
        'sudo netstat -tulpn | grep 2525',
      ],
    },
    {
      title: '5. Interspire Email Marketer SMTP Connection',
      desc: 'Connect Interspire Email Marketer or any email application to your PowerMTA server.',
      commands: [
        'SMTP Hostname: mail.amiralucia.com (or your server IP: 51.170.132.86)',
        'SMTP Port: 2525 (or 25)',
        'VirtualMTA Header: X-VirtualMTA: vmta-mkt-ip1',
        'Return-Path: bounce@amiralucia.com',
      ],
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#8cc052]" />
            <h1 className="text-2xl font-bold text-gray-800">PowerMTA Installation &amp; Setup Guide</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Complete deployment documentation for installing PowerMTA with VirtualMTAs and Interspire Email Marketer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded bg-[#f4faee] border border-[#c9e89b] text-[#5b8c25] text-xs font-bold">
            PowerMTA 5.0r8 Certified
          </span>
        </div>
      </div>

      {/* Intro Hero Banner matching powermtapw.github.io */}
      <div className="pmta-card p-6 bg-gradient-to-r from-gray-900 to-[#1a2530] text-white rounded-lg space-y-3">
        <div className="flex items-center gap-2 text-[#8cc052] text-xs font-bold uppercase tracking-wider">
          <Server className="w-4 h-4" />
          <span>High Volume Control and Delivery</span>
        </div>
        <h2 className="text-xl md:text-2xl font-bold">
          PowerMTA + Interspire Email Marketer Infrastructure
        </h2>
        <p className="text-sm text-gray-300 max-w-3xl leading-relaxed">
          PowerMTA is an enterprise SMTP server application deployed by leading email service providers worldwide.
          It complies with ISP policies for accountable outbound email delivery, automated IP rotation, rate limiting, and real-time bounce tracking.
        </p>
      </div>

      {/* Installation Steps */}
      <div className="space-y-6">
        {steps.map((step, idx) => (
          <div key={idx} className="pmta-card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-base">{step.title}</h3>
              <span className="text-xs text-gray-400 font-semibold">Step 0{idx + 1}</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">{step.desc}</p>
              <div className="bg-gray-950 rounded p-4 font-mono text-xs text-gray-200 space-y-1 relative group">
                <button
                  onClick={() => copyCommand(step.commands.join('\n'), idx)}
                  className="absolute right-3 top-3 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs flex items-center gap-1 transition"
                  title="Copy commands"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#8cc052]" />
                      <span className="text-[#8cc052]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                {step.commands.map((cmd, cIdx) => (
                  <div
                    key={cIdx}
                    className={cmd.startsWith('#') ? 'text-gray-500 italic' : 'text-[#8cc052] font-semibold'}
                  >
                    {cmd}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ Section from powermta.html */}
      <div className="pmta-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#8cc052]" />
          <h3 className="text-lg font-bold text-gray-800">Frequently Asked Questions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div className="p-4 bg-gray-50 rounded border border-gray-100 space-y-1">
            <h4 className="font-bold text-gray-800">What is a VirtualMTA?</h4>
            <p className="text-xs leading-relaxed">
              A VirtualMTA defines an outbound IP address, hostname, and rate limit rules so you can isolate bulk marketing mail from high-priority transactional emails.
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded border border-gray-100 space-y-1">
            <h4 className="font-bold text-gray-800">How does IP rotation work?</h4>
            <p className="text-xs leading-relaxed">
              By grouping VirtualMTAs into an IP Pool, PowerMTA automatically balances sending volume across all assigned IP interfaces in a round-robin or weighted fashion.
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded border border-gray-100 space-y-1">
            <h4 className="font-bold text-gray-800">Can I throttle speed per destination?</h4>
            <p className="text-xs leading-relaxed">
              Yes! Under the "Speed Throttling" tab, you can set maximum message rates (e.g., 100/min for Gmail, 60/min for Yahoo) to protect your sender reputation.
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded border border-gray-100 space-y-1">
            <h4 className="font-bold text-gray-800">How are bounces handled?</h4>
            <p className="text-xs leading-relaxed">
              PowerMTA classifies SMTP responses into hard bounces (550) and soft bounces (421/450). Hard bounces are immediately added to your global suppression list.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
