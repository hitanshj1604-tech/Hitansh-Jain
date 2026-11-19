import React, { useState } from 'react';
import { Check, Copy, MessageSquare, X } from 'lucide-react';
import { InvoiceRecord } from '../types/finance';
import { formatINR, formatShortDate, getDaysOverdue } from '../utils/formatters';

interface ReminderModalProps {
  invoice: InvoiceRecord | null;
  businessName: string;
  referenceDate: string;
  onClose: () => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  invoice,
  businessName,
  referenceDate,
  onClose,
}) => {
  const [tone, setTone] = useState<'polite' | 'firm'>('polite');
  const [copied, setCopied] = useState(false);

  if (!invoice) return null;

  const balance = Math.max(0, invoice.amount - invoice.paidAmount);
  const daysOverdue = getDaysOverdue(invoice, referenceDate);

  const message =
    tone === 'polite'
      ? `Namaste ${invoice.customerName},\n\nGentle payment reminder from ${businessName} regarding Invoice ${invoice.invoiceNumber} dated ${formatShortDate(invoice.issueDate)}.\n\nPending Balance: ${formatINR(balance)}${
          daysOverdue > 0
            ? ` (${daysOverdue} days past due date ${formatShortDate(invoice.dueDate)})`
            : ` (Due on ${formatShortDate(invoice.dueDate)})`
        }.\n\nKindly arrange the payment via UPI / NEFT at your earliest convenience and share the reference. Thank you for your continued business.`
      : `Dear ${invoice.customerName},\n\nThis is a priority follow-up from ${businessName}. Invoice ${invoice.invoiceNumber} has an overdue balance of ${formatINR(balance)} (${daysOverdue} days past due date ${formatShortDate(invoice.dueDate)}).\n\nPlease clear this outstanding balance by tomorrow to keep your credit account active. Let us know once transferred.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const cleanPhone = invoice.customerPhone.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="reminder-modal-title" className="text-base font-semibold text-slate-900">
              Payment Reminder — {invoice.customerName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {invoice.invoiceNumber} · Balance {formatINR(balance)}
              {daysOverdue > 0 ? ` · ${daysOverdue} days overdue` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">Message Tone</span>
            <div className="inline-flex p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setTone('polite')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  tone === 'polite' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Polite Follow-up
              </button>
              <button
                type="button"
                onClick={() => setTone('firm')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  tone === 'firm' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Urgent Overdue
              </button>
            </div>
          </div>

          <textarea
            readOnly
            rows={7}
            value={message}
            className="w-full p-3.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg leading-relaxed focus:outline-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4" />
              Open in WhatsApp
            </a>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy Message'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
