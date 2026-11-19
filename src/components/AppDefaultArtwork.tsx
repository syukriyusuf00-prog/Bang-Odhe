import type { MediaSlotId } from '../types';

interface AppDefaultArtworkProps {
  slotId: Exclude<MediaSlotId, 'hero_portrait'>;
  title: string;
}

export function AppDefaultArtwork({ slotId, title }: AppDefaultArtworkProps) {
  if (slotId === 'app_sispermbg') {
    return (
      <div
        className="w-full h-full bg-[#F4F8F6] flex flex-col justify-between p-6 select-none relative overflow-hidden"
        aria-label={`Pratinjau visual ${title}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="text-xs font-semibold text-[#146C43] tracking-tight">
            SISPERMBG · Perencanaan Menu
          </div>
          <div className="font-mono text-[11px] text-slate-500 tabular-nums">
            2.150 kkal / hari
          </div>
        </div>

        <div className="my-4 space-y-2.5">
          {[
            { label: 'Energi Total', value: '2.150 kkal', pct: 86, color: '#146C43' },
            { label: 'Protein Hewani & Nabati', value: '74 g', pct: 78, color: '#0284C7' },
            { label: 'Karbohidrat Kompleks', value: '310 g', pct: 82, color: '#0B2535' },
            { label: 'Mikronutrien & Serat', value: '96 % AKG', pct: 94, color: '#D97706' },
          ].map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-medium">{row.label}</span>
                <span className="font-mono text-[#0B2535] font-medium tabular-nums">
                  {row.value}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${row.pct}%`, backgroundColor: row.color }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
          <span>Siklus Menu 10 Hari</span>
          <span>Portal Resmi GiziSync</span>
        </div>
      </div>
    );
  }

  if (slotId === 'app_status_gizi') {
    return (
      <div
        className="w-full h-full bg-[#F3F8FC] flex flex-col justify-between p-6 select-none relative overflow-hidden"
        aria-label={`Pratinjau visual ${title}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="text-xs font-semibold text-[#0284C7] tracking-tight">
            Status Gizi · Kurva Antropometri
          </div>
          <div className="font-mono text-[11px] text-slate-500 tabular-nums">
            Z-Score WHO
          </div>
        </div>

        <div className="my-3 flex-1 flex items-center">
          <svg
            viewBox="0 0 320 110"
            className="w-full h-28"
            role="img"
            aria-label="Ilustrasi kurva pertumbuhan Z-Score"
          >
            <line x1="20" y1="20" x2="305" y2="20" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" />
            <line x1="20" y1="55" x2="305" y2="55" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" />
            <line x1="20" y1="90" x2="305" y2="90" stroke="#CBD5E1" strokeWidth="1" />
            <path
              d="M 24 84 C 85 78, 145 58, 210 42 C 250 32, 280 26, 302 22"
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <path
              d="M 24 88 C 85 81, 145 64, 210 49 C 250 39, 280 33, 302 30"
              fill="none"
              stroke="#0284C7"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M 24 92 C 85 88, 145 77, 210 66 C 250 58, 280 54, 302 51"
              fill="none"
              stroke="#146C43"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <circle cx="145" cy="64" r="4" fill="#FFFFFF" stroke="#0284C7" strokeWidth="2.5" />
            <circle cx="210" cy="49" r="4" fill="#FFFFFF" stroke="#0284C7" strokeWidth="2.5" />
            <circle cx="302" cy="30" r="4.5" fill="#146C43" stroke="#FFFFFF" strokeWidth="2" />
          </svg>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
          <span>BB/U · TB/U · IMT/U</span>
          <span>Portal Resmi GiziSync</span>
        </div>
      </div>
    );
  }

  if (slotId === 'app_gizi_seimbang') {
    return (
      <div
        className="w-full h-full bg-[#F4F9F7] flex flex-col justify-between p-6 select-none relative overflow-hidden"
        aria-label={`Pratinjau visual ${title}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="text-xs font-semibold text-[#146C43] tracking-tight">
            Gizi Seimbang · Panduan Isi Piringku
          </div>
          <div className="font-mono text-[11px] text-slate-500 tabular-nums">
            4 Pilar Gizi
          </div>
        </div>

        <div className="my-4 grid grid-cols-2 gap-3">
          {[
            { label: 'Makanan Pokok', share: '2/3 dari 1/2 piring', accent: '#0B2535', pct: 66 },
            { label: 'Sayuran Segar', share: '2/3 dari 1/2 piring', accent: '#146C43', pct: 66 },
            { label: 'Lauk Berprotein', share: '1/3 dari 1/2 piring', accent: '#0284C7', pct: 34 },
            { label: 'Buah-Buahan', share: '1/3 dari 1/2 piring', accent: '#D97706', pct: 34 },
          ].map((part) => (
            <div
              key={part.label}
              className="bg-white/90 border border-slate-200/80 rounded-lg px-3 py-2.5 flex flex-col justify-between gap-2"
            >
              <div>
                <div className="text-[11px] font-semibold text-[#0B2535] leading-tight">
                  {part.label}
                </div>
                <div className="font-mono text-[10px] text-slate-500 mt-0.5 tabular-nums">
                  {part.share}
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${part.pct}%`, backgroundColor: part.accent }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
          <span>Edukasi & Porsi Harian</span>
          <span>Portal Resmi GiziSync</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full bg-[#F8F8F5] flex flex-col justify-between p-6 select-none relative overflow-hidden"
      aria-label={`Pratinjau visual ${title}`}
    >
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div className="text-xs font-semibold text-[#0B2535] tracking-tight">
          SOP SISTAKOL BGN · Formulir SPPG
        </div>
        <div className="font-mono text-[11px] text-slate-500 tabular-nums">
          4/4 Tahap
        </div>
      </div>

      <div className="my-4 space-y-2.5">
        {[
          { code: 'SOP-01', name: 'Penerimaan & Seleksi Bahan Pangan', state: 'Terverifikasi' },
          { code: 'SOP-02', name: 'Higiene Sanitasi & Suhu Pengolahan', state: 'Terverifikasi' },
          { code: 'SOP-03', name: 'Pemorsian & Uji Organoleptik Harian', state: 'Terverifikasi' },
          { code: 'SOP-04', name: 'Distribusi & Dokumentasi SPPG', state: 'Siap Cetak' },
        ].map((item) => (
          <div
            key={item.code}
            className="flex items-center justify-between text-[11px] py-1 border-b border-slate-200/60 last:border-b-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-slate-400 shrink-0">{item.code}</span>
              <span className="text-[#0B2535] font-medium truncate">{item.name}</span>
            </div>
            <span className="text-[#146C43] font-medium shrink-0 ml-2">{item.state}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
        <span>Standar Tata Kelola BGN</span>
        <span>Portal Resmi GiziSync</span>
      </div>
    </div>
  );
}
