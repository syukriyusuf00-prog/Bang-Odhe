import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  Loader2,
  MessageSquare,
  Send,
  Star,
  Trash2,
} from 'lucide-react';
import type { AppTargetOption, ReviewItem } from '../types';
import { ALLOWED_APP_TARGETS, VALIDATION_LIMITS } from '../types';

interface ReviewSectionProps {
  reviews: ReviewItem[];
  loading: boolean;
  errorMessage: string | null;
  currentUser: User | null;
  isAdmin: boolean;
  onSubmitReview: (input: {
    authorName: string;
    authorRole: string;
    appTarget: AppTargetOption;
    rating: number;
    comment: string;
  }) => Promise<void>;
  onDeleteReview: (reviewId: string) => Promise<void>;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Perlu Perbaikan',
  2: 'Kurang',
  3: 'Cukup',
  4: 'Baik',
  5: 'Sangat Baik',
};

function formatIndonesianDate(date: Date | null): string {
  if (!date) return 'Baru saja';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function ReviewSection({
  reviews,
  loading,
  errorMessage,
  currentUser,
  isAdmin,
  onSubmitReview,
  onDeleteReview,
}: ReviewSectionProps) {
  const [authorName, setAuthorName] = useState<string>(currentUser?.displayName ?? '');
  const [authorRole, setAuthorRole] = useState<string>('');
  const [appTarget, setAppTarget] = useState<AppTargetOption>('Umum');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [submittedNotice, setSubmittedNotice] = useState<boolean>(false);

  const [filterApp, setFilterApp] = useState<'Semua' | AppTargetOption>('Semua');
  const [sortBy, setSortBy] = useState<'newest' | 'highest'>('newest');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync display name gently if user signs in while input is empty
  React.useEffect(() => {
    if (currentUser?.displayName && !authorName.trim()) {
      setAuthorName(currentUser.displayName.slice(0, VALIDATION_LIMITS.MAX_AUTHOR_NAME));
    }
  }, [currentUser, authorName]);

  const stats = useMemo(() => {
    const total = reviews.length;
    if (total === 0) {
      return {
        average: 0,
        total: 0,
        distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: 0, pct: 0 })),
      };
    }
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const distribution = [5, 4, 3, 2, 1].map((star) => {
      const count = reviews.filter((r) => r.rating === star).length;
      return { star, count, pct: Math.round((count / total) * 100) };
    });
    return {
      average: sum / total,
      total,
      distribution,
    };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const base =
      filterApp === 'Semua'
        ? reviews
        : reviews.filter((r) => r.appTarget === filterApp);
    return [...base].sort((a, b) => {
      if (sortBy === 'highest') {
        if (b.rating !== a.rating) return b.rating - a.rating;
      }
      const timeA = a.createdAt ? a.createdAt.getTime() : Date.now();
      const timeB = b.createdAt ? b.createdAt.getTime() : Date.now();
      return timeB - timeA;
    });
  }, [reviews, filterApp, sortBy]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmittedNotice(false);

    const trimmedName = authorName.trim();
    const trimmedRole = authorRole.trim();
    const trimmedComment = comment.trim();

    if (
      trimmedName.length < VALIDATION_LIMITS.MIN_AUTHOR_NAME ||
      trimmedName.length > VALIDATION_LIMITS.MAX_AUTHOR_NAME
    ) {
      setFormError(
        `Nama wajib diisi (${VALIDATION_LIMITS.MIN_AUTHOR_NAME}–${VALIDATION_LIMITS.MAX_AUTHOR_NAME} karakter).`
      );
      return;
    }
    if (trimmedRole.length > VALIDATION_LIMITS.MAX_AUTHOR_ROLE) {
      setFormError(`Profesi/Instansi maksimal ${VALIDATION_LIMITS.MAX_AUTHOR_ROLE} karakter.`);
      return;
    }
    if (rating < 1 || rating > 5) {
      setFormError('Silakan pilih rating antara 1 hingga 5 bintang.');
      return;
    }
    if (
      trimmedComment.length < VALIDATION_LIMITS.MIN_COMMENT ||
      trimmedComment.length > VALIDATION_LIMITS.MAX_COMMENT
    ) {
      setFormError(
        `Komentar atau masukan wajib diisi (${VALIDATION_LIMITS.MIN_COMMENT}–${VALIDATION_LIMITS.MAX_COMMENT} karakter).`
      );
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitReview({
        authorName: trimmedName,
        authorRole: trimmedRole,
        appTarget,
        rating,
        comment: trimmedComment,
      });
      setComment('');
      setRating(5);
      setSubmittedNotice(true);
      window.setTimeout(() => setSubmittedNotice(false), 5000);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Gagal mengirim masukan. Silakan coba beberapa saat lagi.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async (reviewId: string) => {
    setDeletingId(reviewId);
    try {
      await onDeleteReview(reviewId);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const activeStarPreview = hoverRating || rating;

  return (
    <section
      id="ulasan"
      className="py-20 sm:py-24 border-t border-slate-200 bg-[#F7FAFC]"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold text-[#146C43] mb-2">
            Partisipasi Pengunjung
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B2535] text-balance">
            Rating, Komentar & Masukan Pengunjung
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
            Bagikan pengalaman, saran pengembangan, maupun penilaian Anda terhadap portal GiziSync dan layanan di dalamnya. Setiap masukan yang dikirim akan langsung tampil dan dapat dibaca pengunjung lain.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Column: Rating Overview + Submission Form */}
          <div className="lg:col-span-5 space-y-6">
            {/* Rating Breakdown Block */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-end justify-between gap-4 pb-5 border-b border-slate-200/80">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Skor Rata-Rata</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold font-mono tabular-nums text-[#0B2535]">
                      {stats.total > 0 ? stats.average.toFixed(1) : '0.0'}
                    </span>
                    <span className="text-sm text-slate-500 font-mono">/ 5.0</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-0.5 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(stats.average)
                            ? 'fill-[#D97706] text-[#D97706]'
                            : 'text-slate-300'
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    {stats.total} ulasan publik
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {stats.distribution.map((row) => (
                  <div key={row.star} className="flex items-center gap-3 text-xs">
                    <span className="w-8 font-mono tabular-nums text-slate-600 shrink-0">
                      {row.star} ★
                    </span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#D97706] rounded-full transition-all duration-300"
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono tabular-nums text-slate-500 shrink-0">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Feedback & Rating Form */}
            <form
              onSubmit={handleFormSubmit}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              noValidate
            >
              <div>
                <h3 className="text-base font-bold text-[#0B2535]">
                  Tulis Rating & Masukan Anda
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Terbuka untuk seluruh pengunjung tanpa perlu mendaftar akun.
                </p>
              </div>

              {/* Interactive Star Rating Picker */}
              <div>
                <label className="block text-xs font-semibold text-[#0B2535] mb-2">
                  Penilaian Bintang
                </label>
                <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg border border-slate-200 bg-[#F7FAFC]">
                  <div
                    className="flex items-center gap-1"
                    role="radiogroup"
                    aria-label="Pilih rating bintang 1 sampai 5"
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={rating === star}
                        aria-label={`${star} bintang — ${RATING_LABELS[star]}`}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                        className="p-1.5 rounded-md focus-visible:outline-2 focus-visible:outline-[#146C43] cursor-pointer transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-6 h-6 transition-colors ${
                            star <= activeStarPreview
                              ? 'fill-[#D97706] text-[#D97706]'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-[#0B2535] whitespace-nowrap">
                    {activeStarPreview}/5 · {RATING_LABELS[activeStarPreview]}
                  </span>
                </div>
              </div>

              {/* Application Scope Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#0B2535] mb-2">
                  Aplikasi yang Dinilai
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALLOWED_APP_TARGETS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setAppTarget(option)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer truncate ${
                        option === 'Umum' ? 'col-span-2' : ''
                      } ${
                        appTarget === option
                          ? 'bg-[#0B2535] text-white border-[#0B2535]'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-[#0B2535]'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Optional Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="review-author-name"
                    className="block text-xs font-semibold text-[#0B2535] mb-1.5"
                  >
                    Nama Anda <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="review-author-name"
                    type="text"
                    required
                    maxLength={VALIDATION_LIMITS.MAX_AUTHOR_NAME}
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Contoh: Syukri Yusuf"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-[#0B2535] placeholder:text-slate-400 focus:outline-none focus:border-[#146C43] focus:ring-2 focus:ring-[#146C43]/15"
                  />
                </div>
                <div>
                  <label
                    htmlFor="review-author-role"
                    className="block text-xs font-semibold text-[#0B2535] mb-1.5"
                  >
                    Profesi / Instansi
                  </label>
                  <input
                    id="review-author-role"
                    type="text"
                    maxLength={VALIDATION_LIMITS.MAX_AUTHOR_ROLE}
                    value={authorRole}
                    onChange={(e) => setAuthorRole(e.target.value)}
                    placeholder="Ahli Gizi / Puskesmas"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-[#0B2535] placeholder:text-slate-400 focus:outline-none focus:border-[#146C43] focus:ring-2 focus:ring-[#146C43]/15"
                  />
                </div>
              </div>

              {/* Comment Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="review-comment"
                    className="block text-xs font-semibold text-[#0B2535]"
                  >
                    Komentar atau Masukan <span className="text-red-600">*</span>
                  </label>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    {comment.length}/{VALIDATION_LIMITS.MAX_COMMENT}
                  </span>
                </div>
                <textarea
                  id="review-comment"
                  rows={4}
                  required
                  maxLength={VALIDATION_LIMITS.MAX_COMMENT}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tulis tanggapan, masukan fitur, atau kesan Anda setelah menggunakan layanan GiziSync..."
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-[#0B2535] placeholder:text-slate-400 focus:outline-none focus:border-[#146C43] focus:ring-2 focus:ring-[#146C43]/15 resize-y"
                />
              </div>

              {formError && (
                <p
                  className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                  role="alert"
                >
                  {formError}
                </p>
              )}

              {submittedNotice && (
                <div
                  className="flex items-center gap-2 text-xs text-[#146C43] bg-[#146C43]/8 border border-[#146C43]/25 rounded-lg px-3 py-2.5 font-medium"
                  role="status"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Terima kasih! Rating dan komentar Anda sudah ditampilkan untuk semua pengunjung.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#146C43] text-white text-sm font-medium hover:bg-[#0F5434] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengirim Ulasan...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Kirim Rating & Komentar
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Live Public Feed Visible to All Visitors */}
          <div className="lg:col-span-7">
            {/* Interactive Filter & Sort Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 mb-6">
              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
                {(['Semua', ...ALLOWED_APP_TARGETS] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterApp(tab)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      filterApp === tab
                        ? 'bg-white text-[#0B2535] shadow-xs'
                        : 'text-slate-600 hover:text-[#0B2535]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="review-sort" className="text-xs text-slate-500 whitespace-nowrap">
                  Urutkan:
                </label>
                <select
                  id="review-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'newest' | 'highest')}
                  className="text-xs font-medium text-[#0B2535] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#146C43] cursor-pointer"
                >
                  <option value="newest">Terbaru</option>
                  <option value="highest">Rating Tertinggi</option>
                </select>
              </div>
            </div>

            {errorMessage && (
              <div
                className="mb-6 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm"
                role="alert"
              >
                {errorMessage}
              </div>
            )}

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse"
                  >
                    <div className="h-4 w-40 bg-slate-200 rounded mb-3" />
                    <div className="h-3 w-full bg-slate-100 rounded mb-2" />
                    <div className="h-3 w-2/3 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-[#0B2535] mb-1">
                  {filterApp === 'Semua'
                    ? 'Belum ada komentar pengunjung'
                    : `Belum ada ulasan untuk ${filterApp}`}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Jadilah pengunjung pertama yang memberikan penilaian bintang dan masukan agar dapat dilihat oleh pengguna lain.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReviews.map((item) => {
                  const canDelete =
                    isAdmin ||
                    Boolean(
                      currentUser?.emailVerified &&
                        item.authorUid &&
                        item.authorUid === currentUser.uid
                    );

                  return (
                    <article
                      key={item.id}
                      className="bg-white border border-slate-200 rounded-xl p-6 transition-colors hover:border-slate-300"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[#0B2535] truncate">
                            {item.authorName}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                            {item.authorRole && (
                              <>
                                <span>{item.authorRole}</span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            <span className="font-medium text-[#146C43]">
                              {item.appTarget}
                            </span>
                            <span aria-hidden="true">·</span>
                            <time className="font-mono tabular-nums text-[11px]">
                              {formatIndonesianDate(item.createdAt)}
                            </time>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div
                            className="flex items-center gap-0.5"
                            aria-label={`Rating ${item.rating} dari 5 bintang`}
                          >
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3.5 h-3.5 ${
                                  star <= item.rating
                                    ? 'fill-[#D97706] text-[#D97706]'
                                    : 'text-slate-200'
                                }`}
                                aria-hidden="true"
                              />
                            ))}
                            <span className="ml-1.5 text-xs font-mono font-semibold text-[#0B2535] tabular-nums">
                              {item.rating}.0
                            </span>
                          </div>

                          {canDelete && (
                            <div className="flex items-center gap-1.5">
                              {confirmDeleteId === item.id ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={deletingId === item.id}
                                    onClick={() => void handleConfirmDelete(item.id)}
                                    className="text-xs font-medium text-red-700 hover:underline cursor-pointer whitespace-nowrap"
                                  >
                                    {deletingId === item.id ? 'Menghapus...' : 'Konfirmasi'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer whitespace-nowrap"
                                  >
                                    Batal
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  aria-label={`Hapus ulasan dari ${item.authorName}`}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-slate-700 leading-relaxed mt-3 whitespace-pre-line break-words">
                        {item.comment}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
