import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import {
  ArrowRight,
  Camera,
  ExternalLink,
  Instagram,
  Link2,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import {
  auth,
  db,
  handleFirestoreError,
  isAdminUser,
  OperationType,
  signInWithGoogle,
  signOutUser,
} from './firebase';
import {
  APPLICATION_CATALOG,
  type AppClickField,
  type AppTargetOption,
  type MediaSlotConfig,
  type MediaSlotId,
  type ReviewItem,
  type SiteMetrics,
} from './types';
import {
  deleteLocalMediaSlot,
  loadAllLocalMediaSlots,
  saveLocalMediaSlot,
} from './utils/localMediaStore';
import { AppDefaultArtwork } from './components/AppDefaultArtwork';
import { PhotoCropEditorModal } from './components/PhotoCropEditorModal';
import { ReviewSection } from './components/ReviewSection';

const VISIT_SESSION_KEY = 'gizisync_visit_counted_v1';
const HERO_DEFAULT_IMAGE = '/assets/gizisync-hero-portrait.png';
const LOGO_IMAGE = '/assets/gizisync-logo.png';

// Shares a single visit-recording promise across React StrictMode double-mounts
let visitRecordPromise: Promise<boolean> | null = null;

const MEDIA_SLOT_IDS: MediaSlotId[] = [
  'hero_portrait',
  'app_sispermbg',
  'app_status_gizi',
  'app_sop_sistakol',
  'app_gizi_seimbang',
];

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate();
  }
  return null;
}

function safeGetSessionStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetSessionStorage(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore restricted iframe or private-mode storage errors
  }
}

function SectionDivider() {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className="relative w-full border-t border-slate-200"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
        <span
          aria-hidden="true"
          className="-mt-[1.5px] block h-[2px] w-16 bg-[#146C43]/45"
        />
      </div>
    </div>
  );
}

export default function App() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authBannerError, setAuthBannerError] = useState<string>('');

  // Live visitor & click metrics from Firestore
  const [metrics, setMetrics] = useState<SiteMetrics>({
    totalVisits: 0,
    sispermbgClicks: 0,
    statusGiziClicks: 0,
    sopSistakolClicks: 0,
    giziSeimbangClicks: 0,
    updatedAt: null,
  });
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  const [visitRecorded, setVisitRecorded] = useState(false);

  // Live public reviews from Firestore
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  // Media slots: cloud (Firestore) + local device overrides (IndexedDB)
  const [cloudSlots, setCloudSlots] = useState<Partial<Record<MediaSlotId, MediaSlotConfig>>>({});
  const [localSlots, setLocalSlots] = useState<Partial<Record<MediaSlotId, MediaSlotConfig>>>({});
  const [activeEditorSlot, setActiveEditorSlot] = useState<MediaSlotId | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  const isAdmin = useMemo(() => isAdminUser(currentUser), [currentUser]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, 4500);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // Load locally cached admin originals only when signed in as verified Admin
  useEffect(() => {
    if (!isAdmin) {
      setLocalSlots({});
      setActiveEditorSlot(null);
      return;
    }
    void loadAllLocalMediaSlots().then((stored) => {
      setLocalSlots(stored);
    });
  }, [isAdmin]);

  // Subscribe to live visitor metrics singleton + detect/record visitor entry once per session
  // Completely public (no login required) so every visitor sees real-time counts
  useEffect(() => {
    const metricsRef = doc(db, 'site_metrics', 'visitors');
    let cancelled = false;

    const applyMetricsSnapshot = (data: Record<string, unknown>) => {
      if (cancelled) return;
      setMetrics({
        totalVisits: Number(data.totalVisits ?? 0),
        sispermbgClicks: Number(data.sispermbgClicks ?? 0),
        statusGiziClicks: Number(data.statusGiziClicks ?? 0),
        sopSistakolClicks: Number(data.sopSistakolClicks ?? 0),
        giziSeimbangClicks: Number(data.giziSeimbangClicks ?? 0),
        updatedAt: toDateOrNull(data.updatedAt),
      });
      setMetricsLoaded(true);
    };

    // Immediate public read fallback for restricted networks / in-app browsers
    void getDoc(metricsRef)
      .then((snap) => {
        if (snap.exists()) {
          applyMetricsSnapshot(snap.data());
        } else if (!cancelled) {
          setMetricsLoaded(true);
        }
      })
      .catch(() => {
        // Real-time listener below handles reporting & updates
      });

    const unsubMetrics = onSnapshot(
      metricsRef,
      (snap) => {
        if (snap.exists()) {
          applyMetricsSnapshot(snap.data());
        } else if (!cancelled) {
          setMetricsLoaded(true);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'site_metrics/visitors', {
          rethrow: false,
        });
        if (!cancelled) setMetricsLoaded(true);
      }
    );

    const recordVisit = async () => {
      try {
        const alreadyCounted = safeGetSessionStorage(VISIT_SESSION_KEY);
        if (alreadyCounted === '1') {
          if (!cancelled) setVisitRecorded(true);
          return;
        }

        if (!visitRecordPromise) {
          visitRecordPromise = (async () => {
            try {
              await updateDoc(metricsRef, {
                totalVisits: increment(1),
                updatedAt: serverTimestamp(),
              });
            } catch (updateErr) {
              const code = (updateErr as { code?: string })?.code;
              if (code === 'not-found') {
                try {
                  await setDoc(metricsRef, {
                    totalVisits: 1,
                    sispermbgClicks: 0,
                    statusGiziClicks: 0,
                    sopSistakolClicks: 0,
                    giziSeimbangClicks: 0,
                    updatedAt: serverTimestamp(),
                  });
                } catch {
                  // Another visitor initialized the singleton concurrently; increment atomically
                  await updateDoc(metricsRef, {
                    totalVisits: increment(1),
                    updatedAt: serverTimestamp(),
                  });
                }
              } else {
                throw updateErr;
              }
            }
            safeSetSessionStorage(VISIT_SESSION_KEY, '1');
            return true;
          })().catch((err) => {
            visitRecordPromise = null;
            handleFirestoreError(err, OperationType.WRITE, 'site_metrics/visitors', {
              rethrow: false,
            });
            return false;
          });
        }

        const ok = await visitRecordPromise;
        if (ok && !cancelled) {
          setVisitRecorded(true);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'site_metrics/visitors', {
          rethrow: false,
        });
      }
    };

    void recordVisit();

    return () => {
      cancelled = true;
      unsubMetrics();
    };
  }, []);

  // Subscribe to published public reviews (sorted client-side to avoid composite index requirements)
  useEffect(() => {
    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('status', '==', 'published'),
      limit(100)
    );

    const unsubReviews = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        const list: ReviewItem[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            authorName: String(d.authorName ?? 'Pengunjung'),
            authorRole: String(d.authorRole ?? ''),
            appTarget: (d.appTarget as AppTargetOption) ?? 'Umum',
            rating: Number(d.rating ?? 5),
            comment: String(d.comment ?? ''),
            status: d.status === 'hidden' ? 'hidden' : 'published',
            authorUid: String(d.authorUid ?? ''),
            createdAt: toDateOrNull(d.createdAt),
          };
        });
        setReviews(list);
        setReviewsLoading(false);
        setReviewsError(null);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'reviews', {
          rethrow: false,
        });
        setReviewsError('Belum dapat memuat daftar ulasan saat ini. Silakan muat ulang halaman.');
        setReviewsLoading(false);
      }
    );

    return () => unsubReviews();
  }, []);

  // Subscribe directly to each of the 4 known media_slots documents (no collection list needed)
  useEffect(() => {
    const unsubs = MEDIA_SLOT_IDS.map((slotId) =>
      onSnapshot(
        doc(db, 'media_slots', slotId),
        (snap) => {
          setCloudSlots((prev) => {
            const next = { ...prev };
            if (snap.exists()) {
              const d = snap.data();
              next[slotId] = {
                slotId,
                imageDataUrl: String(d.imageDataUrl ?? ''),
                zoom: Number(d.zoom ?? 1),
                offsetX: Number(d.offsetX ?? 0),
                offsetY: Number(d.offsetY ?? 0),
                rotation: ([0, 90, 180, 270].includes(Number(d.rotation))
                  ? Number(d.rotation)
                  : 0) as 0 | 90 | 180 | 270,
                aspectRatio: (d.aspectRatio as MediaSlotConfig['aspectRatio']) ?? '16:9',
                updatedAt: toDateOrNull(d.updatedAt),
                source: 'cloud',
              };
            } else {
              delete next[slotId];
            }
            return next;
          });
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, `media_slots/${slotId}`, {
            rethrow: false,
          });
        }
      )
    );

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, []);

  // Visitors strictly see official published cloud slots; only verified Admin merges local originals
  const resolvedMediaSlots = useMemo(() => {
    if (!isAdmin) {
      return cloudSlots;
    }
    const merged: Partial<Record<MediaSlotId, MediaSlotConfig>> = {};
    for (const slotId of MEDIA_SLOT_IDS) {
      const cloud = cloudSlots[slotId];
      const local = localSlots[slotId];
      if (local && cloud) {
        const localTime = local.updatedAt?.getTime() ?? 0;
        const cloudTime = cloud.updatedAt?.getTime() ?? 0;
        merged[slotId] = localTime >= cloudTime ? local : cloud;
      } else if (local) {
        merged[slotId] = local;
      } else if (cloud) {
        merged[slotId] = cloud;
      }
    }
    return merged;
  }, [cloudSlots, localSlots, isAdmin]);

  const openAdminPhotoEditor = useCallback(
    (slotId: MediaSlotId) => {
      if (!isAdmin) return;
      setActiveEditorSlot(slotId);
    },
    [isAdmin]
  );

  const handleRecordAppClick = async (clickField: AppClickField) => {
    const metricsRef = doc(db, 'site_metrics', 'visitors');
    try {
      try {
        await updateDoc(metricsRef, {
          [clickField]: increment(1),
          updatedAt: serverTimestamp(),
        });
      } catch (updateErr) {
        const code = (updateErr as { code?: string })?.code;
        if (code === 'not-found') {
          try {
            await setDoc(metricsRef, {
              totalVisits: 1,
              sispermbgClicks: 0,
              statusGiziClicks: 0,
              sopSistakolClicks: 0,
              giziSeimbangClicks: 0,
              updatedAt: serverTimestamp(),
            });
          } catch {
            // Concurrently initialized
          }
          await updateDoc(metricsRef, {
            [clickField]: increment(1),
            updatedAt: serverTimestamp(),
          });
        } else {
          throw updateErr;
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'site_metrics/visitors', {
        rethrow: false,
      });
    }
  };

  const handleAdminSignIn = async () => {
    setAuthLoading(true);
    setAuthBannerError('');
    try {
      const user = await signInWithGoogle();
      if (isAdminUser(user)) {
        showToast('Berhasil masuk sebagai Admin GiziSync. Perubahan foto akan tampil ke semua pengunjung.');
      } else {
        showToast(`Masuk sebagai ${user.displayName || user.email}. Ulasan Anda akan terverifikasi.`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      if (!message.includes('popup-closed-by-user')) {
        setAuthBannerError('Gagal membuka jendela login Google. Pastikan popup tidak diblokir browser.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    showToast('Anda telah keluar dari akun Google.');
  };

  const handleSaveMediaSlot = async (
    config: MediaSlotConfig,
    publishToCloud: boolean
  ) => {
    if (!isAdmin || !currentUser) {
      throw new Error('Hanya Admin terverifikasi yang dapat mengubah gambar landing page.');
    }

    await saveLocalMediaSlot(config);
    setLocalSlots((prev) => ({ ...prev, [config.slotId]: config }));

    if (publishToCloud) {
      const slotRef = doc(db, 'media_slots', config.slotId);
      try {
        await setDoc(slotRef, {
          slotId: config.slotId,
          imageDataUrl: config.imageDataUrl,
          zoom: config.zoom,
          offsetX: config.offsetX,
          offsetY: config.offsetY,
          rotation: config.rotation,
          aspectRatio: config.aspectRatio,
          updatedBy: currentUser.uid,
          updatedAt: serverTimestamp(),
        });
        showToast('Foto presisi berhasil disimpan dan dipublikasikan ke seluruh pengunjung.');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `media_slots/${config.slotId}`, {
          rethrow: false,
        });
        throw new Error(
          'Gagal menyinkronkan foto ke server. Coba perkecil ukuran crop.'
        );
      }
    }
  };

  const handleResetMediaSlot = async (slotId: MediaSlotId) => {
    if (!isAdmin || !currentUser) return;

    await deleteLocalMediaSlot(slotId);
    setLocalSlots((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });

    if (cloudSlots[slotId]) {
      try {
        await deleteDoc(doc(db, 'media_slots', slotId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `media_slots/${slotId}`, {
          rethrow: false,
        });
      }
    }
    showToast('Foto berhasil dikembalikan ke tampilan bawaan.');
  };

  const handleSubmitReview = async (input: {
    authorName: string;
    authorRole: string;
    appTarget: AppTargetOption;
    rating: number;
    comment: string;
  }) => {
    const newDocRef = doc(collection(db, 'reviews'));
    const verifiedUid =
      currentUser && currentUser.emailVerified ? currentUser.uid : '';
    try {
      await setDoc(newDocRef, {
        authorName: input.authorName,
        authorRole: input.authorRole,
        appTarget: input.appTarget,
        rating: Math.round(input.rating),
        comment: input.comment,
        status: 'published',
        authorUid: verifiedUid,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reviews/${newDocRef.id}`, {
        rethrow: false,
      });
      throw new Error('Gagal menyimpan ulasan. Periksa koneksi internet dan coba lagi.');
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
      showToast('Ulasan berhasil dihapus.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reviews/${reviewId}`, {
        rethrow: false,
      });
      showToast('Tidak memiliki izin untuk menghapus ulasan ini.');
    }
  };

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, item) => acc + item.rating, 0);
    return sum / reviews.length;
  }, [reviews]);

  const totalAppClicks =
    metrics.sispermbgClicks +
    metrics.statusGiziClicks +
    metrics.sopSistakolClicks +
    metrics.giziSeimbangClicks;

  const editorMeta = useMemo(() => {
    if (!activeEditorSlot) return null;
    if (activeEditorSlot === 'hero_portrait') {
      return {
        slotId: 'hero_portrait' as MediaSlotId,
        title: 'Foto Utama Bagian Tengah',
        defaultImageUrl: HERO_DEFAULT_IMAGE,
      };
    }
    const found = APPLICATION_CATALOG.find((a) => a.slotId === activeEditorSlot);
    return {
      slotId: activeEditorSlot,
      title: found ? `Aplikasi ${found.name}` : 'Foto Aplikasi',
      defaultImageUrl: undefined,
    };
  }, [activeEditorSlot]);

  const heroMedia = resolvedMediaSlots.hero_portrait;
  const heroImageSrc = heroMedia?.imageDataUrl || HERO_DEFAULT_IMAGE;

  return (
    <div id="beranda" className="min-h-screen flex flex-col bg-white text-[#0B2535]">
      {/* =====================================================================
          HEADER ATAS — LOGO KIRI (Gambar 1)
          Strict 3-zone Top Bar Contract separated by gap-8
      ===================================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single clean brand logo element on the left */}
          <a
            href="#beranda"
            className="flex items-center shrink-0 focus-visible:outline-2 focus-visible:outline-[#146C43] rounded-md"
            aria-label="GiziSync — Kembali ke Beranda"
          >
            <img
              src={LOGO_IMAGE}
              alt="GiziSync Nutrition Synchronized"
              referrerPolicy="no-referrer"
              className="h-9 sm:h-10 w-auto object-contain"
            />
          </a>

          {/* Zone 2: 4 clean single-line navigation links */}
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <a
              href="#beranda"
              className="hover:text-[#0B2535] transition-colors whitespace-nowrap shrink-0"
            >
              Beranda
            </a>
            <a
              href="#aplikasi"
              className="hover:text-[#0B2535] transition-colors whitespace-nowrap shrink-0"
            >
              Daftar Aplikasi
            </a>
            <a
              href="#ulasan"
              className="hover:text-[#0B2535] transition-colors whitespace-nowrap shrink-0"
            >
              Rating & Ulasan
            </a>
            <a
              href="#hubungi-kami"
              className="hover:text-[#0B2535] transition-colors whitespace-nowrap shrink-0"
            >
              Hubungi Kami
            </a>
          </nav>

          {/* Zone 3: 1 primary CTA action */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="#aplikasi"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#146C43] text-white text-xs sm:text-sm font-medium hover:bg-[#0F5434] transition-colors whitespace-nowrap shrink-0"
            >
              Buka Aplikasi
            </a>
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label={mobileNavOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              aria-expanded={mobileNavOpen}
              className="md:hidden w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-[#0B2535] hover:bg-slate-50 cursor-pointer"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Clean collapsible mobile menu */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-1">
            {[
              { href: '#beranda', label: 'Beranda' },
              { href: '#aplikasi', label: 'Daftar Aplikasi' },
              { href: '#ulasan', label: 'Rating & Ulasan' },
              { href: '#hubungi-kami', label: 'Hubungi Kami' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0B2535]"
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* Transient notification bar */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-[#0B2535] text-white text-xs sm:text-sm px-4 py-3 rounded-lg shadow-xl border border-slate-700 flex items-center justify-between gap-3"
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            aria-label="Tutup pemberitahuan"
            className="text-slate-300 hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="flex-1">
        {/* ===================================================================
            BAGIAN TENGAH — HERO SECTION DENGAN FOTO PRESISI (Gambar 1 & 3)
        =================================================================== */}
        <section className="pt-10 pb-14 sm:pt-14 sm:pb-20 bg-white animate-fade-in">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              {/* Left Column: Precision Editable Portrait Frame (Gambar 1 & 3) */}
              <div className="lg:col-span-5 flex flex-col">
                <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="relative flex-1 min-h-[360px] sm:min-h-[430px] bg-white flex items-end justify-center overflow-hidden">
                    <img
                      src={heroImageSrc}
                      alt="LA ODE MUHAMMAD SUKRI YUSUF, S.Tr.Gz — Ahli Gizi GiziSync"
                      referrerPolicy="no-referrer"
                      className={`w-full h-full ${
                        heroMedia ? 'object-cover' : 'object-contain object-bottom pt-6 px-4'
                      }`}
                    />
                  </div>

                  {/* Clean Frame Footer with Name (read-only for visitors) */}
                  <div className="px-5 py-4 bg-[#F7FAFC] border-t border-slate-200 flex items-center justify-between gap-3">
                    <div className="text-center sm:text-left flex-1 min-w-0">
                      <div className="text-sm sm:text-[15px] font-bold tracking-tight text-[#0B2535] leading-snug">
                        LA ODE MUHAMMAD SUKRI YUSUF, S.Tr.Gz
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Ahli Gizi · GiziSync
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => openAdminPhotoEditor('hero_portrait')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-[#0B2535] hover:border-[#146C43] hover:text-[#146C43] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Atur Foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: GiziSync Brand Anchor + Tagline + Primary CTA */}
              <div className="lg:col-span-7 flex flex-col justify-center py-2">
                <img
                  src={LOGO_IMAGE}
                  alt="Logo GiziSync"
                  referrerPolicy="no-referrer"
                  className="h-16 sm:h-20 md:h-24 w-auto object-contain self-start mb-7"
                />

                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-[#0B2535] leading-[1.15] text-balance">
                  Sederhanakan Perhitungan Gizi, Efisien Waktu, Sinkronkan Layanan Anda Berbasis Digital.
                </h1>

                <p className="text-base sm:text-lg text-slate-600 leading-relaxed mt-5 max-w-2xl">
                  Platform All-In-One{' '}
                  <strong className="font-semibold text-[#0B2535]">ODHEGIZI</strong>{' '}
                  (Obrolan Digital Hitungan Edukasi GIZI) untuk Ahli Gizi dan pengelola layanan gizi.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-5">
                  <a
                    href="#aplikasi"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#146C43] text-white text-sm font-semibold hover:bg-[#0F5434] transition-colors whitespace-nowrap"
                  >
                    Jelajahi Daftar Aplikasi
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <a
                    href="#ulasan"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0284C7] hover:text-[#0B2535] transition-colors whitespace-nowrap py-2"
                  >
                    Beri Rating & Masukan
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                  <span>Muna Barat, Sulawesi Tenggara</span>
                  <span aria-hidden="true">·</span>
                  <span>{APPLICATION_CATALOG.length} Aplikasi Layanan Gizi Aktif</span>
                  <span aria-hidden="true">·</span>
                  <span>Portal Digital Terintegrasi</span>
                </div>
              </div>
            </div>

            {/* ===============================================================
                LIVE PUBLIC VISITOR & RATING METRICS STRIP (Visible to Everyone)
            =============================================================== */}
            <div
              aria-label="Statistik publik GiziSync"
              className="mt-12 sm:mt-16 border-y border-slate-200 py-7 sm:py-8 animate-fade-in fade-delay-100"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-5 mb-6 border-b border-slate-100 text-xs text-slate-500">
                <span className="font-semibold text-[#0B2535]">
                  Statistik Publik GiziSync
                </span>
                <span>Terbuka dan dapat dilihat langsung oleh seluruh pengunjung</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <div className="py-4 sm:py-5 sm:pr-6 lg:py-0 lg:pr-6 border-b border-slate-200 sm:border-r lg:border-b-0">
                  <div className="text-xs font-medium text-slate-500 mb-1">
                    Jumlah Pengunjung Terdeteksi
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#0B2535]">
                    {metricsLoaded
                      ? new Intl.NumberFormat('id-ID').format(metrics.totalVisits)
                      : '—'}
                  </div>
                  <div className="text-xs text-[#146C43] mt-1 font-medium">
                    {visitRecorded ? 'Kunjungan Anda tercatat otomatis' : 'Mendeteksi kunjungan...'}
                  </div>
                </div>

                <div className="py-4 sm:py-5 sm:pl-6 lg:py-0 lg:px-6 border-b border-slate-200 lg:border-b-0 lg:border-r">
                  <div className="text-xs font-medium text-slate-500 mb-1">
                    Akses Daftar Aplikasi
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#0B2535]">
                    {metricsLoaded
                      ? new Intl.NumberFormat('id-ID').format(totalAppClicks)
                      : '—'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Total klik pada {APPLICATION_CATALOG.length} tautan aplikasi
                  </div>
                </div>

                <div className="py-4 sm:py-5 sm:pr-6 lg:py-0 lg:px-6 border-b border-slate-200 sm:border-b-0 sm:border-r">
                  <div className="text-xs font-medium text-slate-500 mb-1">
                    Rating Pengguna
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#0B2535]">
                      {reviews.length > 0 ? averageRating.toFixed(1) : '—'}
                    </span>
                    {reviews.length > 0 && (
                      <Star
                        className="w-5 h-5 fill-[#D97706] text-[#D97706]"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {reviews.length > 0 ? 'Skala penilaian 1.0 – 5.0' : 'Belum ada penilaian masuk'}
                  </div>
                </div>

                <div className="py-4 sm:py-5 sm:pl-6 lg:py-0 lg:pl-6">
                  <div className="text-xs font-medium text-slate-500 mb-1">
                    Komentar & Masukan Publik
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#0B2535]">
                    {reviewsLoading
                      ? '—'
                      : new Intl.NumberFormat('id-ID').format(reviews.length)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Tampil terbuka untuk seluruh pengunjung
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SectionDivider />

        {/* ===================================================================
            DAFTAR APLIKASI — SISPERMBG, STATUS GIZI, SOP SISTAKOL BGN, GIZI SEIMBANG
        =================================================================== */}
        <section
          id="aplikasi"
          className="py-16 sm:py-20 bg-[#F7FAFC] animate-fade-in fade-delay-200"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold text-[#146C43] mb-2">
                  Portal Layanan Terpadu
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B2535] text-balance">
                  Daftar Aplikasi GiziSync
                </h2>
                <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
                  Klik langsung tautan aplikasi yang dibutuhkan untuk mengakses layanan perencanaan menu, pemantauan status gizi, standar operasional SPPG, serta panduan gizi seimbang secara cepat dan terpadu.
                </p>
              </div>

              {isAdmin && currentUser && (
                <div className="flex items-center gap-3 text-xs text-slate-600 bg-[#F7FAFC] border border-slate-200 rounded-lg px-3.5 py-2 shrink-0">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-[#146C43]" />
                  <span className="truncate max-w-[200px] font-medium text-[#0B2535]">
                    Mode Admin Aktif
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-red-700 cursor-pointer whitespace-nowrap ml-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Keluar
                  </button>
                </div>
              )}
            </div>

            {authBannerError && (
              <p
                className="mb-6 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5"
                role="alert"
              >
                {authBannerError}
              </p>
            )}

            {/* 4-Application Balanced 2x2 Editorial Showcase Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
              {APPLICATION_CATALOG.map((app) => {
                const slotMedia = resolvedMediaSlots[app.slotId];
                const clickCount = metrics[app.clickField];

                return (
                  <article
                    key={app.slotId}
                    className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden transition-colors hover:border-slate-300"
                  >
                    {/* Precision Editable Photo Viewport */}
                    <div className="relative aspect-[16/10] w-full bg-[#F7FAFC] border-b border-slate-200 overflow-hidden group">
                      {slotMedia?.imageDataUrl ? (
                        <img
                          src={slotMedia.imageDataUrl}
                          alt={`Tampilan aplikasi ${app.name}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <AppDefaultArtwork slotId={app.slotId} title={app.name} />
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openAdminPhotoEditor(app.slotId)}
                          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B2535]/88 hover:bg-[#0B2535] text-white text-xs font-medium backdrop-blur-xs transition-colors cursor-pointer whitespace-nowrap shadow-sm"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          {slotMedia ? 'Atur / Ganti Foto' : 'Unggah Foto'}
                        </button>
                      )}
                    </div>

                    {/* Card Details — Zero Pill Badges, Clean Unboxed Metadata */}
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mb-2">
                        <span className="font-mono font-semibold text-[#146C43]">
                          {app.numberLabel}.
                        </span>
                        <span>{app.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Intl.NumberFormat('id-ID').format(clickCount)} kunjungan
                        </span>
                      </div>

                      <h3 className="text-xl font-bold tracking-tight text-[#0B2535]">
                        {app.name}
                      </h3>

                      <p className="text-sm text-slate-600 leading-relaxed mt-2.5">
                        {app.description}
                      </p>

                      <ul className="mt-4 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-4">
                        {app.highlights.map((point) => (
                          <li key={point} className="flex items-start gap-2">
                            <span
                              className="text-[#146C43] font-bold leading-4"
                              aria-hidden="true"
                            >
                              —
                            </span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-4 font-mono text-[11px] text-slate-400 truncate">
                        {app.displayHost}
                      </div>

                      {/* Working Actions: Direct Link + Precision Photo Editor */}
                      <div className="mt-5 pt-4 border-t border-slate-200/80 flex items-center gap-2.5">
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => void handleRecordAppClick(app.clickField)}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#146C43] text-white text-xs sm:text-sm font-medium hover:bg-[#0F5434] transition-colors whitespace-nowrap"
                        >
                          Buka Aplikasi
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => openAdminPhotoEditor(app.slotId)}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-[#0B2535] hover:border-[#0284C7] hover:text-[#0284C7] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            Atur Foto
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <SectionDivider />

        {/* ===================================================================
            SECTION RATING, KOMENTAR & MASUKAN PUBLIK
        =================================================================== */}
        <ReviewSection
          reviews={reviews}
          loading={reviewsLoading}
          errorMessage={reviewsError}
          currentUser={currentUser}
          isAdmin={isAdmin}
          onSubmitReview={handleSubmitReview}
          onDeleteReview={handleDeleteReview}
        />
      </main>

      <SectionDivider />

      {/* =====================================================================
          HEADER BAWAH / FOOTER — HUBUNGI KAMI & LOGO GIZISYNC (Gambar 2)
      ===================================================================== */}
      <footer
        id="hubungi-kami"
        className="bg-[#F7FAFC] pt-16 pb-10 animate-fade-in fade-delay-400"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Centered Hubungi Kami Block mirroring Gambar 2 */}
          <div className="text-center pb-12 border-b border-slate-200">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B2535]">
              Hubungi Kami
            </h2>
            <p className="mt-3 inline-flex items-center justify-center gap-2 text-sm sm:text-base font-medium text-slate-700">
              <MapPin className="w-4 h-4 text-[#146C43] shrink-0" aria-hidden="true" />
              <span>Muna Barat - Sulawesi Tenggara - Indonesia</span>
            </p>

            {/* Primary WhatsApp Direct Contact CTA */}
            <div className="mt-6 flex justify-center">
              <a
                href="https://wa.me/6282271095251?text=Halo%20GiziSync%2C%20saya%20ingin%20bertanya%20mengenai%20layanan%20GiziSync."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-lg bg-[#146C43] hover:bg-[#0F5434] text-white text-sm font-semibold transition-colors whitespace-nowrap"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M12.031 2C6.494 2 2 6.494 2 12.031c0 1.766.462 3.49 1.339 5.01L2 22l5.095-1.336a10.002 10.002 0 0 0 4.936 1.298h.004c5.537 0 10.031-4.494 10.031-10.031C22.066 6.494 17.568 2 12.031 2zm5.847 14.165c-.248.698-1.448 1.338-1.999 1.42-.51.076-1.174.108-1.896-.12-.437-.139-.997-.324-1.718-.635-3.025-1.306-5.001-4.354-5.152-4.555-.151-.201-1.23-1.637-1.23-3.123 0-1.486.779-2.216 1.055-2.518.276-.302.603-.377.804-.377.201 0 .402.002.578.01.186.009.435-.071.681.519.251.604.855 2.088.93 2.239.075.151.126.327.025.528-.101.201-.151.327-.302.503-.151.176-.318.393-.452.528-.151.151-.308.315-.132.617.176.302.782 1.29 1.679 2.09 1.153 1.028 2.126 1.347 2.428 1.498.302.151.478.126.654-.076.176-.201.754-.88.955-1.182.201-.302.402-.251.679-.151.276.101 1.759.83 2.061.981.302.151.503.226.578.352.075.126.075.729-.173 1.427z" />
                </svg>
                <span>Hubungi via WhatsApp</span>
                <span className="font-mono text-xs text-white/85 tabular-nums font-normal">
                  0822-7109-5251
                </span>
              </a>
            </div>

            {/* Social Media & Direct Contact Links */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://www.instagram.com/syukri_odhe?jplx=Ym85cDlvaW1tZjk2"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-[#0B2535] hover:border-[#146C43] hover:text-[#146C43] transition-colors whitespace-nowrap"
              >
                <Instagram className="w-4 h-4 text-[#146C43] shrink-0" aria-hidden="true" />
                <span>Instagram</span>
                <span className="text-xs text-slate-500 font-normal">@syukri_odhe</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              </a>

              <a
                href="http://tiktok.com/@syukri_odhe"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-[#0B2535] hover:border-[#146C43] hover:text-[#146C43] transition-colors whitespace-nowrap"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 text-[#0B2535] shrink-0"
                  aria-hidden="true"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.87a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.3z" />
                </svg>
                <span>TikTok</span>
                <span className="text-xs text-slate-500 font-normal">@syukri_odhe</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              </a>

              <a
                href="https://lynk.id/odhe98"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-[#0B2535] hover:border-[#0284C7] hover:text-[#0284C7] transition-colors whitespace-nowrap"
              >
                <Link2 className="w-4 h-4 text-[#0284C7] shrink-0" aria-hidden="true" />
                <span>Lynk.id</span>
                <span className="text-xs text-slate-500 font-normal">lynk.id/odhe98</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              </a>

              <a
                href="mailto:syukriyusuf82@gmail.com"
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-[#0B2535] hover:border-[#146C43] hover:text-[#146C43] transition-colors whitespace-nowrap"
              >
                <Mail className="w-4 h-4 text-[#146C43] shrink-0" aria-hidden="true" />
                <span>Email</span>
                <span className="text-xs text-slate-500 font-normal">syukriyusuf82@gmail.com</span>
              </a>
            </div>
          </div>

          {/* Lower Footer Row: Quiet Links on Left + GiziSync Logo on Right (Gambar 2) */}
          <div className="pt-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
            <div className="grid grid-cols-2 gap-10 sm:gap-16 text-sm">
              <div>
                <h3 className="text-xs font-semibold text-[#0B2535] mb-3">
                  Navigasi Portal
                </h3>
                <ul className="space-y-2 text-slate-600">
                  <li>
                    <a href="#beranda" className="hover:text-[#0B2535] transition-colors">
                      Beranda
                    </a>
                  </li>
                  <li>
                    <a href="#aplikasi" className="hover:text-[#0B2535] transition-colors">
                      Daftar Aplikasi
                    </a>
                  </li>
                  <li>
                    <a href="#ulasan" className="hover:text-[#0B2535] transition-colors">
                      Rating & Ulasan
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#0B2535] mb-3">
                  Tautan Aplikasi
                </h3>
                <ul className="space-y-2 text-slate-600">
                  {APPLICATION_CATALOG.map((app) => (
                    <li key={app.slotId}>
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => void handleRecordAppClick(app.clickField)}
                        className="hover:text-[#146C43] transition-colors inline-flex items-center gap-1"
                      >
                        <span>{app.name}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom-right GiziSync Logo exactly matching Gambar 2 */}
            <div className="md:text-right">
              <img
                src={LOGO_IMAGE}
                alt="GiziSync Nutrition Synchronized"
                referrerPolicy="no-referrer"
                className="h-14 sm:h-16 w-auto object-contain md:ml-auto"
              />
              <p className="text-xs text-slate-500 mt-3">
                © {new Date().getFullYear()} GiziSync · Muna Barat, Sulawesi Tenggara, Indonesia.
              </p>
              <div className="mt-2 flex md:justify-end">
                {currentUser ? (
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" aria-hidden="true" />
                    <span>Keluar ({isAdmin ? 'Admin' : currentUser.email})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={() => void handleAdminSignIn()}
                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    <LogIn className="w-3 h-3" aria-hidden="true" />
                    <span>{authLoading ? 'Menghubungkan...' : 'Akses Pengelola'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          PRECISION PHOTO UPLOAD & CROP EDITOR MODAL (Verified Admin Only)
      ===================================================================== */}
      {isAdmin && editorMeta && (
        <PhotoCropEditorModal
          isOpen={Boolean(activeEditorSlot)}
          slotId={editorMeta.slotId}
          slotTitle={editorMeta.title}
          defaultImageUrl={editorMeta.defaultImageUrl}
          currentConfig={resolvedMediaSlots[editorMeta.slotId]}
          isAdmin={isAdmin}
          onAdminSignIn={handleAdminSignIn}
          onClose={() => setActiveEditorSlot(null)}
          onSave={handleSaveMediaSlot}
          onResetToDefault={handleResetMediaSlot}
        />
      )}
    </div>
  );
}
