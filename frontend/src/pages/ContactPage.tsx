import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, MessageCircle, Phone, UserCheck } from 'lucide-react';
import { api } from '../api/client';
import type { PengurusContact, Ticket } from '../types';
import { PageHeader } from '../components/PageHeader';

export function ContactPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'kontak';
  const [contacts, setContacts] = useState<PengurusContact[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    api.getDashboard().then((d) => setContacts(d.contacts)).catch(console.error);
    api.getTickets().then(setTickets).catch(console.error);
  }, []);

  return (
    <div>
      <PageHeader
        title="Kontak & Status Laporan"
        subtitle="Hubungi pengurus Victoria Hill atau pantau progres tiket laporan warga"
      />

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'kontak' })}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition cursor-pointer ${
            tab !== 'status'
              ? 'bg-[#1b4532] text-white'
              : 'bg-white border border-[#dce5df] text-[#42564a]'
          }`}
        >
          <Phone className="w-4 h-4" />
          Kontak Pengurus
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'status' })}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition cursor-pointer ${
            tab === 'status'
              ? 'bg-[#1b4532] text-white'
              : 'bg-white border border-[#dce5df] text-[#42564a]'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Cek Status Laporan ({tickets.length})
        </button>
      </div>

      {tab !== 'status' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="rounded-3xl bg-white border border-[#dce5df] p-6 shadow-xs flex flex-col justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e8f0eb] text-[#176b4b]">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17251f]">{c.name}</h3>
                  <p className="text-sm font-medium text-[#176b4b]">{c.position}</p>
                  <p className="text-xs text-[#506457] mt-1">
                    {c.house} · {c.phone}
                  </p>
                </div>
              </div>
              <a
                href={`https://wa.me/${c.whatsapp}?text=${encodeURIComponent(
                  `Halo ${c.name}, saya warga Victoria Hill ingin berkonsultasi.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1b4532] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#133325] transition"
              >
                <MessageCircle className="w-4 h-4" />
                Hubungi via WhatsApp
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="rounded-3xl bg-white border border-[#dce5df] p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-[#1b4532] bg-[#eef4ef] px-2.5 py-1 rounded-full">
                    {t.ticket_no}
                  </span>
                  <span className="text-sm font-bold text-[#17251f]">
                    {t.category} — {t.location}
                  </span>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    t.status === 'Selesai'
                      ? 'bg-[#dff0e4] text-[#176b4b]'
                      : t.status === 'Diproses'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-[#ee4129]'
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <p className="mt-2.5 text-sm text-[#42564a]">{t.description}</p>
              <div className="mt-2 text-xs text-[#5c6b63]">
                Pelapor: {t.reporter_name} {t.house_code ? `(${t.house_code})` : ''} ·{' '}
                {new Date(t.created_at).toLocaleDateString('id-ID')}
              </div>
              {t.admin_note && (
                <div className="mt-3 rounded-2xl bg-[#f4f7f5] border border-[#dce5df] px-4 py-2.5 text-xs text-[#1b4532]">
                  <span className="font-bold">Tindak lanjut pengurus:</span> {t.admin_note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
