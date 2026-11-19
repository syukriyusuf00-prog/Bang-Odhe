export type MediaSlotId =
  | 'hero_portrait'
  | 'app_sispermbg'
  | 'app_status_gizi'
  | 'app_sop_sistakol'
  | 'app_gizi_seimbang';

export type AspectRatioOption = 'free' | '16:9' | '4:3' | '3:2' | '1:1' | '4:5';

export type AppTargetOption =
  | 'Umum'
  | 'SISPERMBG'
  | 'Status Gizi'
  | 'SOP SISTAKOL BGN'
  | 'Aplikasi Gizi Seimbang';

export const ALLOWED_APP_TARGETS: AppTargetOption[] = [
  'Umum',
  'SISPERMBG',
  'Status Gizi',
  'SOP SISTAKOL BGN',
  'Aplikasi Gizi Seimbang',
];

export const VALIDATION_LIMITS = {
  MIN_AUTHOR_NAME: 2,
  MAX_AUTHOR_NAME: 60,
  MAX_AUTHOR_ROLE: 80,
  MIN_COMMENT: 3,
  MAX_COMMENT: 600,
  MAX_IMAGE_DATA_URL_LENGTH: 350000,
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 3.0,
} as const;

export interface CropFrameBox {
  /** Normalized 0..1 relative to stage */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MediaSlotConfig {
  slotId: MediaSlotId;
  imageDataUrl: string;
  originalDataUrl?: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  rotation: 0 | 90 | 180 | 270;
  aspectRatio: AspectRatioOption;
  cropBox?: CropFrameBox;
  updatedAt?: Date | null;
  source?: 'default' | 'local' | 'cloud';
}

export interface SiteMetrics {
  totalVisits: number;
  sispermbgClicks: number;
  statusGiziClicks: number;
  sopSistakolClicks: number;
  giziSeimbangClicks: number;
  updatedAt?: Date | null;
}

export interface ReviewItem {
  id: string;
  authorName: string;
  authorRole: string;
  appTarget: AppTargetOption;
  rating: number;
  comment: string;
  status: 'published' | 'hidden';
  authorUid: string;
  createdAt: Date | null;
}

export type AppClickField =
  | 'sispermbgClicks'
  | 'statusGiziClicks'
  | 'sopSistakolClicks'
  | 'giziSeimbangClicks';

export interface ApplicationEntry {
  slotId: Exclude<MediaSlotId, 'hero_portrait'>;
  numberLabel: string;
  name: string;
  targetKey: Exclude<AppTargetOption, 'Umum'>;
  clickField: AppClickField;
  url: string;
  displayHost: string;
  category: string;
  description: string;
  highlights: string[];
}

export const APPLICATION_CATALOG: ApplicationEntry[] = [
  {
    slotId: 'app_sispermbg',
    numberLabel: '01',
    name: 'SISPERMBG',
    targetKey: 'SISPERMBG',
    clickField: 'sispermbgClicks',
    url: 'https://e-gizi-mu.vercel.app/',
    displayHost: 'e-gizi-mu.vercel.app',
    category: 'Perencanaan Menu & Gizi',
    description:
      'Sistem Perencanaan Menu dan Pengelolaan Makanan Bergizi untuk mempercepat perhitungan kebutuhan zat gizi, penyusunan siklus menu, serta dokumentasi operasional layanan gizi.',
    highlights: [
      'Kalkulasi nilai gizi terstruktur',
      'Penyusunan siklus menu harian',
      'Dokumentasi operasional praktis',
    ],
  },
  {
    slotId: 'app_status_gizi',
    numberLabel: '02',
    name: 'Status Gizi',
    targetKey: 'Status Gizi',
    clickField: 'statusGiziClicks',
    url: 'https://gizi-sync-status-gizi-qu.vercel.app/',
    displayHost: 'gizi-sync-status-gizi-qu.vercel.app',
    category: 'Evaluasi Antropometri',
    description:
      'Aplikasi pemantauan dan evaluasi status gizi berbasis indikator antropometri untuk membantu Ahli Gizi melakukan skrining, klasifikasi, dan tindak lanjut secara cepat dan presisi.',
    highlights: [
      'Klasifikasi indikator antropometri',
      'Hasil evaluasi cepat & akurat',
      'Mendukung pelaporan lapangan',
    ],
  },
  {
    slotId: 'app_sop_sistakol',
    numberLabel: '03',
    name: 'SOP SISTAKOL BGN',
    targetKey: 'SOP SISTAKOL BGN',
    clickField: 'sopSistakolClicks',
    url: 'https://sistakol-bgn-formulir-sop-sppg.ai.studio/',
    displayHost: 'sistakol-bgn-formulir-sop-sppg.ai.studio',
    category: 'Standar Operasional & SPPG',
    description:
      'Portal formulir Standar Operasional Prosedur SPPG dan tata kelola BGN guna menjaga konsistensi mutu, keamanan pangan, dan verifikasi kelengkapan dokumen layanan secara digital.',
    highlights: [
      'Formulir digital SOP SPPG terstandar',
      'Verifikasi kepatuhan mutu layanan',
      'Arsip tata kelola siap audit',
    ],
  },
  {
    slotId: 'app_gizi_seimbang',
    numberLabel: '04',
    name: 'Aplikasi Gizi Seimbang',
    targetKey: 'Aplikasi Gizi Seimbang',
    clickField: 'giziSeimbangClicks',
    url: 'https://sites.google.com/view/aplikasigiziseimbang/full-page-embed',
    displayHost: 'sites.google.com/view/aplikasigiziseimbang',
    category: 'Panduan & Edukasi Gizi',
    description:
      'Aplikasi panduan dan edukasi gizi seimbang untuk membantu Ahli Gizi serta masyarakat menerapkan pola makan sehat, porsi seimbang, dan kebutuhan gizi harian secara praktis.',
    highlights: [
      'Panduan komposisi gizi seimbang',
      'Media edukasi & konseling praktis',
      'Akses langsung dalam tampilan penuh',
    ],
  },
];
