import { useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';

interface FaqItem {
  id: string;
  number: string;
  category: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-apa-itu-gizisync',
    number: '01',
    category: 'Umum',
    question: 'Apa itu GiziSync dan siapa saja yang dapat menggunakannya?',
    answer:
      'GiziSync adalah portal digital terpadu yang dirancang untuk membantu Ahli Gizi, tenaga kesehatan, serta pengelola layanan gizi (seperti SPPG, puskesmas, dan fasilitas pelayanan gizi) menyederhanakan perhitungan gizi, pemantauan status gizi, dan dokumentasi standar operasional secara praktis dalam satu pintu.',
  },
  {
    id: 'faq-perbedaan-aplikasi',
    number: '02',
    category: 'Layanan Aplikasi',
    question:
      'Apa perbedaan fungsi antara SISPERMBG, Status Gizi, SOP SISTAKOL BGN, dan Aplikasi Gizi Seimbang?',
    answer:
      'SISPERMBG berfokus pada perencanaan siklus menu dan pengelolaan perhitungan makanan bergizi harian. Status Gizi digunakan untuk mengevaluasi dan mengklasifikasikan indikator antropometri secara cepat dan presisi. SOP SISTAKOL BGN menyediakan formulir digital Standar Operasional Prosedur SPPG dan tata kelola BGN. Sementara itu, Aplikasi Gizi Seimbang menyajikan panduan dan media edukasi pola makan bergizi seimbang secara praktis.',
  },
  {
    id: 'faq-rating-komentar',
    number: '03',
    category: 'Ulasan & Rating',
    question: 'Apakah rating dan masukan yang saya kirim langsung tampil dan dapat dilihat orang lain?',
    answer:
      'Ya. Setiap penilaian bintang (1–5) dan komentar masukan yang Anda kirim melalui bagian Rating & Ulasan langsung tersimpan secara real-time dan ditampilkan terbuka agar dapat dibaca oleh pengunjung maupun tenaga gizi lainnya, serta otomatis memperbarui skor rata-rata portal.',
  },
  {
    id: 'faq-kontak-bantuan',
    number: '04',
    category: 'Dukungan',
    question: 'Bagaimana cara menghubungi pengelola GiziSync untuk bantuan teknis atau saran pengembangan?',
    answer:
      'Anda dapat menuliskan masukan langsung melalui formulir komentar di halaman ini, atau menghubungi pengelola GiziSync melalui tautan Instagram (@syukri_odhe), TikTok (@syukri_odhe), Lynk.id, maupun email resmi syukriyusuf82@gmail.com pada bagian Hubungi Kami di bawah halaman.',
  },
];

export function FaqSection() {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    [FAQ_ITEMS[0].id]: true,
  });

  const allExpanded = FAQ_ITEMS.every((item) => Boolean(openIds[item.id]));

  const toggleItem = (id: string) => {
    setOpenIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleAll = () => {
    if (allExpanded) {
      setOpenIds({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const item of FAQ_ITEMS) {
      next[item.id] = true;
    }
    setOpenIds(next);
  };

  return (
    <section
      id="faq"
      className="py-20 sm:py-24 border-t border-slate-200 bg-white"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left Sticky Editorial Intro Column */}
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <p className="text-xs font-semibold text-[#146C43] mb-2">
              Pusat Informasi
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B2535] text-balance">
              Pertanyaan Sering Diajukan
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
              Jawaban ringkas seputar layanan GiziSync, akses aplikasi SISPERMBG, Status Gizi, SOP SISTAKOL BGN, Aplikasi Gizi Seimbang, hingga cara penggunaan fitur portal.
            </p>

            <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
              <div className="text-xs text-slate-500">
                Masih memiliki pertanyaan atau saran khusus?
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <a
                  href="#ulasan"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#146C43] hover:text-[#0F5434] transition-colors whitespace-nowrap"
                >
                  Tulis Masukan
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
                <a
                  href="#hubungi-kami"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0284C7] hover:text-[#0B2535] transition-colors whitespace-nowrap"
                >
                  Hubungi Kami
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          {/* Right Clean Hairline-Divided FAQ Accordion */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between pb-4">
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {FAQ_ITEMS.length} topik utama
              </span>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-medium text-[#0284C7] hover:text-[#0B2535] transition-colors cursor-pointer whitespace-nowrap"
              >
                {allExpanded ? 'Tutup Semua' : 'Buka Semua'}
              </button>
            </div>

            <div className="border-y border-slate-200 divide-y divide-slate-200">
              {FAQ_ITEMS.map((item) => {
                const isOpen = Boolean(openIds[item.id]);
                const panelId = `${item.id}-panel`;
                const buttonId = `${item.id}-trigger`;

                return (
                  <div key={item.id}>
                    <h3>
                      <button
                        id={buttonId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => toggleItem(item.id)}
                        className="w-full py-5 text-left flex items-start justify-between gap-4 group cursor-pointer focus-visible:outline-2 focus-visible:outline-[#146C43] rounded-sm"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                            <span className="font-mono font-semibold text-[#146C43] tabular-nums">
                              {item.number}.
                            </span>
                            <span>{item.category}</span>
                          </div>
                          <span className="block text-base font-semibold text-[#0B2535] group-hover:text-[#146C43] transition-colors leading-snug">
                            {item.question}
                          </span>
                        </div>
                        <span
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-[#F7FAFC] group-hover:border-slate-300 flex items-center justify-center shrink-0 mt-1 text-slate-600"
                          aria-hidden="true"
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isOpen ? 'rotate-180 text-[#146C43]' : ''
                            }`}
                          />
                        </span>
                      </button>
                    </h3>

                    {isOpen && (
                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={buttonId}
                        className="pb-5 pr-2 sm:pr-12 text-sm sm:text-[15px] text-slate-600 leading-relaxed"
                      >
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
