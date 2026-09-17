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
    <div className="p-2 sm:p-4 md:p-6 bg-[#E8ECEF] min-h-[calc(100vh-3.5rem)] font-sans text-gray-800">
      <div className="max-w-[1240px] mx-auto bg-white rounded-lg shadow-md border border-[#C5CED6] overflow-hidden">
        {/* Top Crimson Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-[#8B1A10] via-[#A81D14] to-[#75110B] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#E0A328]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-black/25 flex items-center justify-center text-white border border-white/20 shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>PowerMTA Installation &amp; Setup Guide</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 border border-white/20 text-[#FFD54F]">
                  5.0r8 Certified
                </span>
              </h1>
              <p className="text-[11px] text-gray-200 mt-0.5 hidden sm:block">
                Complete deployment documentation for installing PowerMTA with VirtualMTAs and Interspire Email Marketer.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* Installation Steps */}
          <div className="space-y-4">
            {steps.map((step, idx) => (
              <div key={idx} className="border border-[#CCD2D8] rounded bg-white shadow-xs overflow-hidden">
                <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#CCD2D8] flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 text-xs sm:text-sm">{step.title}</h3>
                  <span className="text-xs text-[#8B1A10] font-mono font-bold">Step 0{idx + 1}</span>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-xs text-gray-700">{step.desc}</p>
                  
                  {/* Linux CRT Terminal Command Box */}
                  <div className="rounded bg-black border border-[#1b3d1b] p-3 font-mono text-xs text-[#00FF66] relative group">
                    <button
                      onClick={() => copyCommand(step.commands.join('\n'), idx)}
                      className="absolute right-2.5 top-2.5 px-2 py-1 bg-[#00FF66]/20 hover:bg-[#00FF66]/30 text-[#00FF66] border border-[#00FF66]/40 rounded text-[10px] font-bold flex items-center gap-1 transition"
                      title="Copy commands"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3 h-3 text-[#00FF66]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <div className="space-y-1 pr-16">
                      {step.commands.map((cmd, cIdx) => (
                        <div
                          key={cIdx}
                          className={cmd.startsWith('#') ? 'text-gray-500 italic' : 'text-[#00FF66] font-semibold'}
                        >
                          {cmd}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="border border-[#CCD2D8] rounded bg-white shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-[#9E9E9E] border-b-2 border-[#8B0000] text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#FFD54F]" />
              <h3 className="text-xs sm:text-sm font-bold text-white">Frequently Asked Questions</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 text-xs text-gray-700">
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#CCD2D8] space-y-1">
                <h4 className="font-bold text-gray-900">What is a VirtualMTA?</h4>
                <p className="text-[11px] leading-relaxed text-gray-600">
                  A VirtualMTA defines an outbound IP address, hostname, and rate limit rules so you can isolate bulk marketing mail from high-priority transactional emails.
                </p>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#CCD2D8] space-y-1">
                <h4 className="font-bold text-gray-900">How does IP rotation work?</h4>
                <p className="text-[11px] leading-relaxed text-gray-600">
                  By grouping VirtualMTAs into an IP Pool, PowerMTA automatically balances sending volume across all assigned IP interfaces in a round-robin or weighted fashion.
                </p>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#CCD2D8] space-y-1">
                <h4 className="font-bold text-gray-900">Can I throttle speed per destination?</h4>
                <p className="text-[11px] leading-relaxed text-gray-600">
                  Yes! Under the "Speed Throttling" tab, you can set maximum message rates (e.g., 100/min for Gmail, 60/min for Yahoo) to protect your sender reputation.
                </p>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#CCD2D8] space-y-1">
                <h4 className="font-bold text-gray-900">How are bounces handled?</h4>
                <p className="text-[11px] leading-relaxed text-gray-600">
                  PowerMTA classifies SMTP responses into hard bounces (550) and soft bounces (421/450). Hard bounces are immediately added to your global suppression list.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
