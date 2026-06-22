import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  Save,
  Upload,
  CalendarClock,
  ImagePlus,
  X,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { getElectronAPI } from '@/lib/electronApi';
import { useLanguageStore } from '@/store/useLanguageStore';
import type {
  BulkPublishEligibilityReason,
  BulkPublishPrepareRowPayload,
  FacebookPageTargetOption,
  PostSnapshot,
} from '@/types/electron';

type RowSaveState = 'idle' | 'saving' | 'saved' | 'error';
type RowPostStatus = 'draft' | 'scheduled';
const CONTROLLED_BULK_PUBLISH_BATCH_LIMIT = 3;

interface BulkRowImageMedia {
  id: number | null;
  mediaLocalPath: string;
  mediaType: 'photo';
  previewUrl: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  extension?: string;
  importedFromCsv?: boolean;
  needsReattach?: boolean;
}

interface BulkRowVideoMedia {
  id: number | null;
  mediaLocalPath: string;
  mediaType: 'video';
  previewUrl: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  extension: string;
  durationMs?: number;
  importedFromCsv?: boolean;
  needsReattach?: boolean;
}

interface BulkRowMediaState {
  images: BulkRowImageMedia[];
  video: BulkRowVideoMedia | null;
}

interface BulkRow {
  id: string;
  title: string;
  content: string;
  format: 'post' | 'story';
  targetPageId: string;
  scheduledDate: string;
  scheduledTime: string;
  postStatus: RowPostStatus;
  media: BulkRowMediaState;
  validationError: string | null;
  saveState: RowSaveState;
  saveError?: string;
}

interface ImportPreview {
  totalRows: number;
  importedRows: number;
  failedRows: number;
  mediaRows: number;
  messages: string[];
}

interface BulkEligibilityReviewRow {
  rowId: string;
  rowIndex: number;
  title: string;
  targetPageLabel: string;
  postStatus: RowPostStatus;
  hasImage: boolean;
  isEligible: boolean;
  reasonKey: BulkPublishEligibilityReason | null;
  reason: string | null;
  validationScope: 'row' | 'persisted_post';
  existingPostId?: number | null;
}

interface BulkPublishProgressRow {
  rowId: string;
  rowIndex: number;
  title: string;
  postId?: number;
  status:
    | 'queued'
    | 'posting'
    | 'published'
    | 'failed'
    | 'blocked'
    | 'cancelled'
    | 'creating'
    | 'create_failed';
  message: string;
  canCancelBeforeStart?: boolean;
}

interface BulkPublishProgressSnapshot {
  selectedCount: number;
  eligibleCount: number;
  queuedCount: number;
  postingCount: number;
  publishedCount: number;
  failedCount: number;
  blockedCount: number;
  cancelledCount: number;
  results: BulkPublishProgressRow[];
  executionMode: 'queue_backed_controlled_publish';
}

function genId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function maskIdentifier(value: string | null | undefined) {
  if (!value) return 'Unknown';
  if (value.length <= 6) return `••${value.slice(-2)}`;
  return `${value.slice(0, 2)}••••${value.slice(-4)}`;
}

function normalizeCsvCell(value: string) {
  return value.trim().replace(/^"(.*)"$/, '$1').trim();
}

function buildScheduledAt(date: string, time: string) {
  if (!date || !time) return null;
  return new Date(`${date}T${time}:00`);
}

function formatFileSize(fileSizeBytes: number, language: 'vi' | 'en') {
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return language === 'vi' ? 'Không rõ kích thước' : 'Unknown size';
  }

  if (fileSizeBytes < 1024) {
    return `${fileSizeBytes} B`;
  }

  if (fileSizeBytes < 1024 * 1024) {
    return `${(fileSizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isSupportedImagePath(filePath: string) {
  return /\.(jpe?g|png|webp)$/i.test(filePath);
}

function getSafeFileName(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop();
  return fileName && fileName.trim() ? fileName : 'image';
}

function buildImportedPreviewUrl(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.startsWith('file://') ? normalizedPath : `file:///${normalizedPath}`;
}

function createEmptyRowMedia(): BulkRowMediaState {
  return {
    images: [],
    video: null,
  };
}

function createCsvImportedImageMedia(
  filePath: string,
  fileSizeBytes: number,
  mimeType: string
): BulkRowImageMedia {
  return {
    id: null,
    mediaLocalPath: filePath,
    mediaType: 'photo',
    previewUrl: buildImportedPreviewUrl(filePath),
    fileName: getSafeFileName(filePath),
    fileSizeBytes,
    mimeType,
    extension: filePath.split('.').pop()?.toLowerCase(),
    importedFromCsv: true,
    needsReattach: false,
  };
}

function createInvalidCsvImageMedia(filePath: string): BulkRowImageMedia {
  return {
    id: null,
    mediaLocalPath: filePath,
    mediaType: 'photo',
    previewUrl: '',
    fileName: getSafeFileName(filePath),
    fileSizeBytes: 0,
    mimeType: 'image/jpeg',
    extension: filePath.split('.').pop()?.toLowerCase(),
    importedFromCsv: true,
    needsReattach: true,
  };
}

export function BulkCreatePage() {
  const electronAPI = getElectronAPI();
  const navigate = useNavigate();
  const { language } = useLanguageStore();

  const [facebookPages, setFacebookPages] = useState<FacebookPageTargetOption[]>([]);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [showImportArea, setShowImportArea] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [lastImportedFileName, setLastImportedFileName] = useState<string | null>(null);
  const [createdPostIds, setCreatedPostIds] = useState<number[]>([]);
  const [realPublishingEnabled, setRealPublishingEnabled] = useState<boolean | undefined>(undefined);
  const [publishingModeStatus, setPublishingModeStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [showBulkPublishModal, setShowBulkPublishModal] = useState(false);
  const [bulkConfirmChecked, setBulkConfirmChecked] = useState(false);
  const [bulkConfirmText, setBulkConfirmText] = useState('');
  const [bulkPublishProgress, setBulkPublishProgress] = useState<BulkPublishProgressSnapshot | null>(null);
  const [bulkPublishSubmitting, setBulkPublishSubmitting] = useState(false);
  const [bulkProgressRefreshTick, setBulkProgressRefreshTick] = useState(0);
  const [bulkPreparedRows, setBulkPreparedRows] = useState<BulkEligibilityReviewRow[]>([]);
  const [bulkConfirmationToken, setBulkConfirmationToken] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [pageData, connectionStatus] = await Promise.all([
          electronAPI.accounts.listFacebookPageTargets(),
          electronAPI.accounts.getConnectionStatus(),
        ]);

        setFacebookPages(pageData);
        setRealPublishingEnabled(connectionStatus.facebook.realPublishingEnabled);
        setPublishingModeStatus('loaded');

        setRows([
          createEmptyRow(''),
          createEmptyRow(''),
          createEmptyRow(''),
        ]);
      } catch (error) {
        setPublishingModeStatus('error');
        setRealPublishingEnabled(undefined);
        setGlobalMessage(
          error instanceof Error
            ? error.message
            : language === 'vi'
              ? 'Không thể tải các Trang Facebook khả dụng.'
              : 'Failed to load available Facebook Pages.'
        );
        setRows([
          createEmptyRow(''),
          createEmptyRow(''),
          createEmptyRow(''),
        ]);
      }
    };

    void loadInitialData();
  }, []);

  function createEmptyRow(targetPageId: string): BulkRow {
    return {
      id: genId(),
      title: '',
      content: '',
      format: 'post',
      targetPageId,
      scheduledDate: '',
      scheduledTime: '',
      postStatus: 'draft',
      media: createEmptyRowMedia(),
      validationError: null,
      saveState: 'idle',
    };
  }

  function findPageById(pageId: string) {
    return facebookPages.find((page) => page.pageId === pageId) ?? null;
  }

  function isRowEmpty(row: BulkRow) {
    return (
      !row.title.trim() &&
      !row.content.trim() &&
      !row.targetPageId.trim() &&
      !row.scheduledDate.trim() &&
      !row.scheduledTime.trim() &&
      row.media.images.length === 0 &&
      !row.media.video
    );
  }

  function validateRow(row: BulkRow): string | null {
    if (isRowEmpty(row)) {
      return null;
    }

    const hasImages = row.media.images.length > 0;
    const hasVideo = !!row.media.video;
    const hasMedia = hasImages || hasVideo;

    if (row.format === 'story') {
      if (hasImages && hasVideo) {
        return language === 'vi'
          ? 'Không thể trộn ảnh và video trong cùng một dòng.'
          : 'Images and video cannot be mixed in the same row.';
      }

      if (!hasMedia) {
        return language === 'vi'
          ? 'Tin cần một ảnh hoặc một video.'
          : 'A Story requires one image or one video.';
      }

      if (row.media.images.length > 1) {
        return language === 'vi'
          ? 'Tin hiện chỉ hỗ trợ đúng một ảnh hoặc một video.'
          : 'Story currently supports exactly one image or one video.';
      }
    }

    if (hasImages && hasVideo) {
      return language === 'vi'
        ? 'Không thể trộn ảnh và video trong cùng một dòng.'
        : 'Images and video cannot be mixed in the same row.';
    }

    if (!row.content.trim() && !hasMedia) {
      return language === 'vi'
        ? 'Thiếu nội dung hoặc media.'
        : 'Missing content or media.';
    }

    if (!row.targetPageId.trim()) {
      return language === 'vi'
        ? 'Chưa chọn kênh đăng'
        : 'No publishing channel selected';
    }

    if (!findPageById(row.targetPageId)) {
      return language === 'vi' ? 'Trang đích đã chọn hiện không khả dụng.' : 'Selected target Page is not available.';
    }

    if (row.media.images.some((image) => image.needsReattach)) {
      return language === 'vi'
        ? 'Không tìm thấy tệp ảnh. Vui lòng đính kèm lại ảnh.'
        : 'Image file not found. Please reattach the image.';
    }

    if (row.media.video?.needsReattach) {
      return language === 'vi'
        ? 'Không tìm thấy tệp video. Vui lòng đính kèm lại video.'
        : 'Video file not found. Please reattach the video.';
    }

    if (row.postStatus === 'scheduled') {
      if (!row.scheduledDate || !row.scheduledTime) {
        return language === 'vi' ? 'Các dòng đã lên lịch bắt buộc phải có thời gian lên lịch.' : 'Schedule time is required for scheduled rows.';
      }

      const scheduledAt = buildScheduledAt(row.scheduledDate, row.scheduledTime);
      if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
        return language === 'vi' ? 'Thời gian lên lịch không hợp lệ.' : 'Schedule time is invalid.';
      }

      if (scheduledAt.getTime() <= Date.now()) {
        return language === 'vi' ? 'Các dòng đã lên lịch phải dùng ngày giờ trong tương lai.' : 'Scheduled rows must use a future date and time.';
      }
    }

    return null;
  }

  function refreshRowValidation(nextRows: BulkRow[]) {
    return nextRows.map((row) => ({
      ...row,
      validationError: validateRow(row),
    }));
  }

  function getBulkEligibilityReasonLabel(reason: BulkPublishEligibilityReason) {
    const labels: Record<BulkPublishEligibilityReason, string> = {
      missing_target_page:
        language === 'vi' ? 'Thiếu Trang đích.' : 'Missing target Page.',
      missing_content_or_image:
        language === 'vi' ? 'Thiếu nội dung hoặc ảnh.' : 'Missing content or image.',
      image_file_missing:
        language === 'vi'
          ? 'Không tìm thấy tệp ảnh. Vui lòng đính kèm lại ảnh.'
          : 'Image file is missing. Reattach the image.',
      unsupported_media_type:
        language === 'vi' ? 'Loại media không được hỗ trợ.' : 'Unsupported media type.',
      already_published:
        language === 'vi' ? 'Đã được đăng trước đó.' : 'Already published.',
      real_publish_disabled:
        language === 'vi'
          ? 'Đăng thật đang bị tắt.'
          : 'Real publish is disabled.',
      missing_source_account_id:
        language === 'vi' ? 'Thiếu source account id.' : 'Missing source account id.',
      page_readiness_failed:
        language === 'vi' ? 'Trạng thái sẵn sàng của Trang không đạt.' : 'Page readiness failed.',
      already_posting:
        language === 'vi' ? 'Đã ở trạng thái queued hoặc posting.' : 'Already queued or posting.',
      cancelled:
        language === 'vi' ? 'Bài viết đã hủy không thể được publish.' : 'Cancelled post cannot be published.',
      invalid:
        language === 'vi' ? 'Dòng không hợp lệ.' : 'Invalid row.',
      needs_verification:
        language === 'vi' ? 'Cần xác minh thủ công.' : 'Needs verification.',
      multi_image:
        language === 'vi'
          ? 'Bulk publish nhiều ảnh chưa được hỗ trợ.'
          : 'Multi-image bulk publish is not supported yet.',
      video:
        language === 'vi'
          ? 'Video chưa được hỗ trợ trong bulk publish.'
          : 'Video is not supported in bulk publish yet.',
      already_queued:
        language === 'vi' ? 'Đã ở trạng thái queued hoặc posting.' : 'Already queued or posting.',
      batch_limit_exceeded:
        language === 'vi'
          ? `Controlled bulk publish chỉ cho phép tối đa ${CONTROLLED_BULK_PUBLISH_BATCH_LIMIT} bài mỗi batch. Hãy giảm số lượng rồi thử lại.`
          : `Controlled bulk publish is limited to ${CONTROLLED_BULK_PUBLISH_BATCH_LIMIT} posts per batch. Reduce the selection and try again.`,
      failed_requires_retry:
        language === 'vi'
          ? 'Bài failed chỉ được publish lại khi có explicit retry.'
          : 'Failed post requires explicit retry.',
    };

    return labels[reason];
  }

  function buildBulkPreparePayload(): BulkPublishPrepareRowPayload[] {
    return validatedRows
      .filter((row) => !isRowEmpty(row))
      .map((row) => {
        const page = findPageById(row.targetPageId);
        return {
          clientRowId: row.id,
          title: row.title || undefined,
          content: row.content,
          postFormat: row.format,
          mediaType: row.media.video ? 'video' : row.media.images.length > 0 ? 'photo' : 'none',
          mediaLocalPath: row.media.video?.mediaLocalPath ?? row.media.images[0]?.mediaLocalPath,
          targetPageId: row.targetPageId || undefined,
          sourceAccountId: page?.sourceAccountId,
          postStatus: row.postStatus,
          existingPostId: null,
        };
      });
  }

  function buildBulkEligibilityReviewFromPrepared(preparedRows: Awaited<ReturnType<typeof electronAPI.bulkPublish.prepare>>['rows']) {
    return preparedRows.map((row, index) => ({
      rowId: row.clientRowId,
      rowIndex: index + 1,
      title: row.title,
      targetPageLabel: row.targetPageLabel,
      postStatus: row.postStatus,
      hasImage: row.hasImage,
      isEligible: row.isEligible,
      reasonKey: row.reasonKey,
      reason: row.reason,
      validationScope: row.validationScope,
      existingPostId: row.existingPostId ?? null,
    } satisfies BulkEligibilityReviewRow));
  }

  function getBulkProgressMessage(post: PostSnapshot) {
    switch (post.status) {
      case 'queued':
        return language === 'vi'
          ? 'Đã tạo post cục bộ và đã xếp hàng chờ queue xử lý.'
          : 'Local post created and queued for processing.';
      case 'posting':
        return language === 'vi'
          ? 'Queue đang xử lý publish cho post này.'
          : 'The queue is currently processing this post.';
      case 'published':
        return language === 'vi'
          ? 'Đã publish thành công qua queue.'
          : 'Published successfully through the queue.';
      case 'blocked':
        return post.errorMessage ||
          (language === 'vi'
            ? 'Post bị chặn bởi điều kiện an toàn hoặc readiness.'
            : 'The post was blocked by safety or readiness checks.');
      case 'failed':
      case 'partially_failed':
        return post.errorMessage ||
          (language === 'vi'
            ? 'Post thất bại trong quá trình queue publish.'
            : 'The post failed during queue-backed publishing.');
      case 'cancelled':
        return language === 'vi'
          ? 'Đã hủy trước khi queue bắt đầu publish.'
          : 'Cancelled before queue processing started.';
      default:
        return post.errorMessage || post.status;
    }
  }

  function buildBulkProgressSnapshot(
    currentResults: BulkPublishProgressRow[],
    latestPostsById?: Map<number, PostSnapshot>
  ): BulkPublishProgressSnapshot {
    const hydratedResults = currentResults.map((result) => {
      const latestPost = result.postId ? latestPostsById?.get(result.postId) : undefined;

      if (!latestPost) {
        return result;
      }

      const normalizedStatus: BulkPublishProgressRow['status'] =
        latestPost.status === 'queued' ||
        latestPost.status === 'posting' ||
        latestPost.status === 'published' ||
        latestPost.status === 'failed' ||
        latestPost.status === 'blocked' ||
        latestPost.status === 'cancelled'
          ? latestPost.status
          : latestPost.status === 'partially_failed'
            ? 'failed'
            : result.status;

      return {
        ...result,
        status: normalizedStatus,
        message: getBulkProgressMessage(latestPost),
        canCancelBeforeStart: normalizedStatus === 'queued',
      };
    });

    return {
      selectedCount: eligibilityReviewRows.length,
      eligibleCount: eligibleBulkRows.length,
      queuedCount: hydratedResults.filter((result) => result.status === 'queued').length,
      postingCount: hydratedResults.filter((result) => result.status === 'posting').length,
      publishedCount: hydratedResults.filter((result) => result.status === 'published').length,
      failedCount: hydratedResults.filter((result) => result.status === 'failed').length,
      blockedCount: hydratedResults.filter((result) => result.status === 'blocked').length,
      cancelledCount: hydratedResults.filter((result) => result.status === 'cancelled').length,
      results: hydratedResults,
      executionMode: 'queue_backed_controlled_publish',
    };
  }

  function resetBulkPublishModalState() {
    setBulkConfirmChecked(false);
    setBulkConfirmText('');
  }

  function updateRow(rowId: string, patch: Partial<BulkRow>) {
    setRows((prev) =>
      refreshRowValidation(
        prev.map((row) =>
          row.id === rowId
            ? {
                ...row,
                ...patch,
                saveError: undefined,
                saveState: row.saveState === 'saved' ? 'idle' : row.saveState,
              }
            : row
        )
      )
    );
  }

  async function attachMediaToRow(rowId: string) {
    try {
      const row = rows.find((item) => item.id === rowId);

      if (!row) {
        return;
      }

      const picked = await electronAPI.media.pickMedia({
        allowImages: true,
        allowVideo: true,
        multipleImages: true,
        maxVideos: 1,
      });

      if (picked.cancelled) {
        return;
      }

      if (picked.validationError) {
        setGlobalMessage(picked.validationError);
        return;
      }

      if (picked.images.length > 0 && picked.video) {
        setGlobalMessage(
          language === 'vi'
            ? 'Không thể trộn ảnh và video trong cùng một dòng.'
            : 'Images and video cannot be mixed in the same row.'
        );
        return;
      }

      if (row.format === 'story' && picked.images.length > 1) {
        setGlobalMessage(
          language === 'vi'
            ? 'Tin hiện chỉ hỗ trợ đúng một ảnh hoặc một video.'
            : 'Story currently supports exactly one image or one video.'
        );
        return;
      }

      if (picked.video) {
        updateRow(rowId, {
          media: {
            images: [],
            video: {
              id: null,
              mediaLocalPath: picked.video.mediaLocalPath,
              mediaType: 'video',
              previewUrl: picked.video.previewUrl,
              fileName: picked.video.fileName,
              fileSizeBytes: picked.video.fileSizeBytes,
              mimeType: picked.video.mimeType,
              extension: picked.video.extension,
              durationMs: picked.video.durationMs,
              importedFromCsv: false,
              needsReattach: false,
            },
          },
        });
        return;
      }

      if (picked.images.length > 0) {
        updateRow(rowId, {
          media: {
            images: picked.images.map((image) => ({
              id: image.id,
              mediaLocalPath: image.mediaLocalPath,
              mediaType: 'photo',
              previewUrl: image.previewUrl,
              fileName: image.fileName,
              fileSizeBytes: image.fileSizeBytes,
              mimeType: image.mimeType,
              extension: image.extension,
              importedFromCsv: false,
              needsReattach: false,
            })),
            video: null,
          },
        });
      }
    } catch (error) {
      setGlobalMessage(
        error instanceof Error
          ? error.message
          : language === 'vi'
            ? 'Không thể đính kèm media cho dòng này.'
            : 'Failed to attach media for this row.'
      );
    }
  }

  function removeMediaFromRow(rowId: string) {
    updateRow(rowId, { media: createEmptyRowMedia() });
  }

  function addRow() {
    setRows((prev) => refreshRowValidation([...prev, createEmptyRow('')]));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  const actionableRows = useMemo(() => rows.filter((row) => !isRowEmpty(row)), [rows]);
  const validatedRows = useMemo(() => refreshRowValidation(rows), [rows]);
  const validRows = validatedRows.filter((row) => !isRowEmpty(row) && !row.validationError);
  const invalidRows = validatedRows.filter((row) => !isRowEmpty(row) && !!row.validationError);
  const draftRows = validRows.filter((row) => row.postStatus === 'draft');
  const scheduledRows = validRows.filter((row) => row.postStatus === 'scheduled');

  const mediaRows = validRows.filter((row) => row.media.images.length > 0 || !!row.media.video);
  const pageDistribution = useMemo(() => {
    const distribution = new Map<string, number>();

    validRows.forEach((row) => {
      const page = findPageById(row.targetPageId);
      const key = page?.pageName ?? row.targetPageId ?? 'Unknown';
      distribution.set(key, (distribution.get(key) ?? 0) + 1);
    });

    return Array.from(distribution.entries());
  }, [validRows, facebookPages]);

  const scheduleDates = useMemo(() => {
    const values = scheduledRows
      .map((row) => buildScheduledAt(row.scheduledDate, row.scheduledTime))
      .filter((value): value is Date => !!value && !Number.isNaN(value.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      earliest: values[0] ?? null,
      latest: values[values.length - 1] ?? null,
    };
  }, [scheduledRows]);

  const saveDisabledReason = useMemo(() => {
    if (submitting) return language === 'vi' ? 'Đang chạy lưu hàng loạt.' : 'Bulk save is already running.';
    if (actionableRows.length === 0) return language === 'vi' ? 'Hãy thêm ít nhất một dòng không rỗng trước.' : 'Add at least one non-empty row first.';
    if (invalidRows.length > 0) return language === 'vi' ? 'Hãy sửa các dòng không hợp lệ trước khi lưu.' : 'Fix invalid rows before saving.';
    return null;
  }, [submitting, actionableRows.length, invalidRows.length, language]);

  const immediateRows = validRows.filter((row) => row.postStatus === 'draft');
  const eligibilityReviewRows = bulkPreparedRows;
  const eligibleBulkRows = eligibilityReviewRows.filter((row) => row.isEligible);
  const ineligibleBulkRows = eligibilityReviewRows.filter((row) => !row.isEligible);
  const selectedTextOnlyRows = eligibilityReviewRows.filter((row) => !row.hasImage);
  const selectedImageRows = eligibilityReviewRows.filter((row) => row.hasImage);
  const selectedImmediateRows = eligibilityReviewRows.filter((row) => row.postStatus === 'draft');
  const selectedScheduledRows = eligibilityReviewRows.filter((row) => row.postStatus === 'scheduled');
  const bulkPublishConfirmReady = bulkConfirmChecked && bulkConfirmText.trim() === 'PUBLISH';
  const bulkPublishBlockedMessage =
    'Bulk real publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable controlled bulk publish.';
  const bulkPublishDisabledReason = useMemo(() => {
    if (publishingModeStatus === 'loading') {
      return language === 'vi'
        ? 'Đang kiểm tra chế độ đăng Facebook...'
        : 'Checking Facebook publishing mode...';
    }

    if (publishingModeStatus === 'error') {
      return language === 'vi'
        ? 'Không thể xác minh chế độ đăng Facebook. Đăng thật hàng loạt bị chặn cho đến khi trạng thái cấu hình tải thành công.'
        : 'Unable to verify Facebook publishing mode. Bulk real publish is blocked until config status loads successfully.';
    }

    if (!realPublishingEnabled) {
      return bulkPublishBlockedMessage;
    }

    if (actionableRows.length === 0) {
      return language === 'vi'
        ? 'Chưa có dòng nào sẵn sàng để kiểm tra đăng thật hàng loạt.'
        : 'No rows are ready for bulk real publish review.';
    }

    if (validRows.length === 0) {
      return language === 'vi'
        ? 'Không có dòng nào đủ điều kiện cơ bản để mở controlled bulk publish review.'
        : 'No rows meet the basic requirements to open controlled bulk publish review.';
    }

    return null;
  }, [publishingModeStatus, realPublishingEnabled, actionableRows.length, validRows.length, language]);

  function parseImportText(textOverride?: string, importedFileName?: string) {
    const sourceText = typeof textOverride === 'string' ? textOverride : importText;
    const lines = sourceText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setImportPreview({
        totalRows: 0,
        importedRows: 0,
        failedRows: 0,
        mediaRows: 0,
        messages: [language === 'vi' ? 'Không có dòng dữ liệu kiểu CSV nào được cung cấp.' : 'No CSV-like rows were provided.'],
      });
      setLastImportedFileName(importedFileName ?? null);
      return;
    }

    const headerCells = lines[0].split(',').map(normalizeCsvCell);
      const columnIndex = {
        title: headerCells.findIndex((cell) => cell.toLowerCase() === 'title'),
        content: headerCells.findIndex((cell) => cell.toLowerCase() === 'content'),
        pageName: headerCells.findIndex((cell) => cell.toLowerCase() === 'pagename'),
        pageId: headerCells.findIndex((cell) => cell.toLowerCase() === 'pageid'),
        scheduleTime: headerCells.findIndex((cell) => cell.toLowerCase() === 'scheduletime'),
        status: headerCells.findIndex((cell) => cell.toLowerCase() === 'status'),
        mediaPath: headerCells.findIndex((cell) => cell.toLowerCase() === 'mediapath'),
        imagePath: headerCells.findIndex((cell) => cell.toLowerCase() === 'imagepath'),
      };

    const messages: string[] = [];
    const imported: BulkRow[] = [];
    let failed = 0;
    let mediaRowsCount = 0;

    for (let i = 1; i < lines.length; i += 1) {
      const cells = lines[i].split(',').map(normalizeCsvCell);

      const title = columnIndex.title >= 0 ? cells[columnIndex.title] ?? '' : '';
      const content = columnIndex.content >= 0 ? cells[columnIndex.content] ?? '' : '';
      const pageName = columnIndex.pageName >= 0 ? cells[columnIndex.pageName] ?? '' : '';
      const pageId = columnIndex.pageId >= 0 ? cells[columnIndex.pageId] ?? '' : '';
      const scheduleTimeRaw =
        columnIndex.scheduleTime >= 0 ? cells[columnIndex.scheduleTime] ?? '' : '';
      const statusRaw = columnIndex.status >= 0 ? cells[columnIndex.status] ?? '' : 'draft';
      const mediaPathRaw =
        columnIndex.mediaPath >= 0
          ? cells[columnIndex.mediaPath] ?? ''
          : columnIndex.imagePath >= 0
            ? cells[columnIndex.imagePath] ?? ''
            : '';

      const matchedPage =
        (pageId && facebookPages.find((page) => page.pageId === pageId)) ||
        (pageName &&
          facebookPages.find(
            (page) => (page.pageName ?? '').toLowerCase() === pageName.toLowerCase()
          )) ||
        null;

      const normalizedStatus: RowPostStatus =
        statusRaw.toLowerCase() === 'scheduled' ? 'scheduled' : 'draft';

      let scheduledDate = '';
      let scheduledTime = '';

      if (scheduleTimeRaw) {
        const parsed = new Date(scheduleTimeRaw);
        if (!Number.isNaN(parsed.getTime())) {
          scheduledDate = parsed.toISOString().slice(0, 10);
          scheduledTime = parsed.toISOString().slice(11, 16);
        } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(scheduleTimeRaw)) {
          const [datePart, timePart] = scheduleTimeRaw.split(' ');
          scheduledDate = datePart;
          scheduledTime = timePart;
        }
      }

      const row: BulkRow = {
        id: genId(),
        title,
        content,
        targetPageId: matchedPage?.pageId ?? '',
        scheduledDate,
        scheduledTime,
        postStatus: normalizedStatus,
        format: 'post',
        media: mediaPathRaw.trim()
          ? {
              images: [createInvalidCsvImageMedia(mediaPathRaw.trim())],
              video: null,
            }
          : createEmptyRowMedia(),
        validationError: null,
        saveState: 'idle',
      };

      if (mediaPathRaw.trim()) {
        mediaRowsCount += 1;

        const normalizedMediaPath = mediaPathRaw.trim();
        if (isSupportedImagePath(normalizedMediaPath)) {
          messages.push(
            language === 'vi'
              ? `Dòng ${i}: Đã phát hiện đường dẫn ảnh. Hệ thống sẽ kiểm tra an toàn trước khi lưu.`
              : `Row ${i}: Image path detected. It will be validated safely before saving.`
          );
        } else {
          row.media = {
            images: [createInvalidCsvImageMedia(normalizedMediaPath)],
            video: null,
          };
        }
      }

      row.validationError = validateRow(row);

      if (pageName || pageId) {
        if (!matchedPage) {
          row.validationError =
            row.validationError ?? 'Unable to map pageName/pageId to an available Facebook Page.';
        }
      }

      imported.push(row);

      if (row.validationError) {
        failed += 1;
        messages.push(`Row ${i}: ${row.validationError}`);
      }
    }

    if (imported.length > 0) {
      void (async () => {
        const validatedImportedRows = await Promise.all(
          imported.map(async (row) => {
            const csvImage = row.media.images[0];

            if (!csvImage?.importedFromCsv || !csvImage.mediaLocalPath) {
              return row;
            }

            try {
              const result = await electronAPI.media.validateImagePath(csvImage.mediaLocalPath);

              if (result.valid && result.mediaLocalPath && result.previewUrl && result.fileName && typeof result.fileSizeBytes === 'number' && result.mimeType) {
                const nextMedia = {
                  images: [
                    createCsvImportedImageMedia(
                      result.mediaLocalPath,
                      result.fileSizeBytes,
                      result.mimeType
                    ),
                  ],
                  video: null,
                };

                return {
                  ...row,
                  media: nextMedia,
                  validationError: validateRow({
                    ...row,
                    media: nextMedia,
                  }),
                };
              }

              return {
                ...row,
                media: {
                  images: [createInvalidCsvImageMedia(csvImage.mediaLocalPath)],
                  video: null,
                },
                validationError:
                  language === 'vi'
                    ? 'Không tìm thấy tệp ảnh. Vui lòng đính kèm lại ảnh.'
                    : 'Image file not found. Please reattach the image.',
              };
            } catch {
              return {
                ...row,
                media: {
                  images: [createInvalidCsvImageMedia(csvImage.mediaLocalPath)],
                  video: null,
                },
                validationError:
                  language === 'vi'
                    ? 'Không tìm thấy tệp ảnh. Vui lòng đính kèm lại ảnh.'
                    : 'Image file not found. Please reattach the image.',
              };
            }
          })
        );

        setRows((prev) => refreshRowValidation([...prev, ...validatedImportedRows]));
      })();
    }

    setImportPreview({
      totalRows: lines.length - 1,
      importedRows: imported.length,
      failedRows: failed,
      mediaRows: mediaRowsCount,
      messages:
        messages.length > 0
          ? messages.slice(0, 8)
          : [language === 'vi' ? 'Đã tải bản xem trước dữ liệu nhập. Hãy kiểm tra các dòng trước khi lưu.' : 'Import preview loaded. Review rows before saving.'],
    });
    setLastImportedFileName(importedFileName ?? null);
  }

  async function handleImportCsvFile() {
    try {
      const imported = await electronAPI.media.importCsvFile();

      if (!imported) {
        return;
      }

      setShowImportArea(true);
      setImportText(imported.text);
      parseImportText(imported.text, imported.fileName);
      setGlobalMessage(
        language === 'vi'
          ? `Đã nhập tệp CSV: ${imported.fileName}`
          : `Imported CSV file: ${imported.fileName}`
      );
    } catch (error) {
      setGlobalMessage(
        error instanceof Error
          ? error.message
          : language === 'vi'
            ? 'Không thể nhập tệp CSV.'
            : 'Failed to import CSV file.'
      );
    }
  }

  async function handleBulkSave() {
    if (saveDisabledReason) {
      setGlobalMessage(saveDisabledReason);
      return;
    }

    setSubmitting(true);
    setGlobalMessage(null);

    let createdDrafts = 0;
    let createdScheduled = 0;
    let failed = 0;
    const savedPostIds: number[] = [];

    for (const row of refreshRowValidation(rows)) {
      if (isRowEmpty(row)) {
        continue;
      }

      if (row.validationError) {
        failed += 1;
        continue;
      }

      const page = findPageById(row.targetPageId);
      if (!page) {
        failed += 1;
        setRows((prev) =>
          prev.map((existing) =>
            existing.id === row.id
              ? {
                  ...existing,
                  saveState: 'error',
                  saveError: language === 'vi' ? 'Trang đích đã chọn không còn khả dụng.' : 'Selected target Page is no longer available.',
                }
              : existing
          )
        );
        continue;
      }

      setRows((prev) =>
        prev.map((existing) =>
          existing.id === row.id
            ? {
                ...existing,
                saveState: 'saving',
                saveError: undefined,
              }
            : existing
        )
      );

      try {
        const scheduledAt =
          row.postStatus === 'scheduled'
            ? buildScheduledAt(row.scheduledDate, row.scheduledTime)?.toISOString()
            : undefined;

        const createdPost = await electronAPI.posts.create({
          title: row.title || undefined,
          content: row.content,
          postFormat: row.format,
          mediaType: row.media.video ? 'video' : row.media.images.length > 0 ? 'photo' : 'none',
          mediaLocalPath: row.media.video?.mediaLocalPath ?? row.media.images[0]?.mediaLocalPath,
          status: row.postStatus,
          scheduledAt,
          targetAccounts: [page.sourceAccountId],
          pageTargets: [
            {
              platform: 'facebook',
              targetType: 'page',
              pageId: page.pageId,
              pageName: page.pageName ?? 'Unnamed Facebook Page',
              sourceAccountId: page.sourceAccountId,
              sourceAccountName: page.sourceAccountName,
            },
          ],
        });

        setRows((prev) =>
          prev.map((existing) =>
            existing.id === row.id
              ? {
                  ...existing,
                  saveState: 'saved',
                  saveError: undefined,
                }
              : existing
          )
        );

        savedPostIds.push(createdPost.id);
        if (row.postStatus === 'scheduled') {
          createdScheduled += 1;
        } else {
          createdDrafts += 1;
        }
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error
            ? error.message
            : language === 'vi'
              ? 'Không thể lưu dòng này.'
              : 'Failed to save row.';
        setRows((prev) =>
          prev.map((existing) =>
            existing.id === row.id
              ? {
                  ...existing,
                  saveState: 'error',
                  saveError: message,
                }
              : existing
          )
        );
      }
    }

    setSubmitting(false);
    setCreatedPostIds(savedPostIds);
    setGlobalMessage(
      language === 'vi'
        ? `Đã tạo nháp: ${createdDrafts} · Đã tạo bài viết đã lên lịch: ${createdScheduled} · Bỏ qua/không hợp lệ: ${failed}`
        : `Created drafts: ${createdDrafts} · Created scheduled posts: ${createdScheduled} · Skipped/invalid: ${failed}`
    );
  }

  async function handleOpenBulkPublishModal() {
    if (bulkPublishDisabledReason) {
      setGlobalMessage(
        !realPublishingEnabled && publishingModeStatus === 'loaded'
          ? bulkPublishBlockedMessage
          : bulkPublishDisabledReason
      );
      return;
    }

    resetBulkPublishModalState();
    setBulkPublishProgress(null);
    setGlobalMessage(null);

    const prepared = await electronAPI.bulkPublish.prepare({
      rows: buildBulkPreparePayload(),
      language,
      batchLimit: CONTROLLED_BULK_PUBLISH_BATCH_LIMIT,
    });

    setBulkPreparedRows(buildBulkEligibilityReviewFromPrepared(prepared.rows));
    setBulkConfirmationToken(`bulk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    setShowBulkPublishModal(true);
  }

  useEffect(() => {
    if (!bulkPublishProgress) {
      return;
    }

    const postIds = bulkPublishProgress.results
      .map((result) => result.postId)
      .filter((value): value is number => typeof value === 'number');

    if (postIds.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setBulkProgressRefreshTick((value) => value + 1);
    }, 2500);

    return () => window.clearInterval(timer);
  }, [bulkPublishProgress]);

  useEffect(() => {
    if (!bulkPublishProgress) {
      return;
    }

    const postIds = bulkPublishProgress.results
      .map((result) => result.postId)
      .filter((value): value is number => typeof value === 'number');

    if (postIds.length === 0) {
      return;
    }

    void (async () => {
      const latestPosts = await electronAPI.bulkPublish.getProgress({ postIds });
      const latestPostsById = new Map<number, PostSnapshot>();

      latestPosts.forEach((post) => {
        latestPostsById.set(post.id, post);
      });

      setBulkPublishProgress((prev) => {
        if (!prev) {
          return prev;
        }

        return buildBulkProgressSnapshot(prev.results, latestPostsById);
      });
    })();
  }, [bulkProgressRefreshTick, electronAPI.posts, bulkPublishProgress]);

  function handleCloseBulkPublishModal() {
    setShowBulkPublishModal(false);
    resetBulkPublishModalState();
  }

  async function handleCancelQueuedBulkPost(postId: number) {
    const result = await electronAPI.bulkPublish.cancelQueued(postId);
    setGlobalMessage(result.message);
    setBulkProgressRefreshTick((value) => value + 1);
  }

  async function handleConfirmControlledBulkPublish() {
    if (!bulkPublishConfirmReady) {
      return;
    }

    setBulkPublishSubmitting(true);

    try {
      const queueableRows = eligibilityReviewRows.filter((row) => row.isEligible);

      if (queueableRows.length > CONTROLLED_BULK_PUBLISH_BATCH_LIMIT) {
        setGlobalMessage(getBulkEligibilityReasonLabel('batch_limit_exceeded'));
        return;
      }

      const result = await electronAPI.bulkPublish.createJobs({
        rows: buildBulkPreparePayload(),
        language,
        batchLimit: CONTROLLED_BULK_PUBLISH_BATCH_LIMIT,
        confirmationText: bulkConfirmText,
        confirmationChecked: bulkConfirmChecked,
        confirmationToken: bulkConfirmationToken ?? `bulk-fallback-${Date.now()}`,
      });

      const queueResults: BulkPublishProgressRow[] = result.results.map((row, index) => ({
        rowId: row.clientRowId,
        rowIndex: index + 1,
        title: row.title,
        postId: row.createdPostId ?? undefined,
        status: row.status,
        message: row.message,
        canCancelBeforeStart: row.canCancelBeforeStart,
      }));

      setCreatedPostIds(result.createdPostIds);
      setBulkPublishProgress(buildBulkProgressSnapshot(queueResults));

      if (result.duplicateBatchBlocked) {
        setGlobalMessage(
          language === 'vi'
            ? 'Batch này đã được xác nhận trước đó. Không có duplicate jobs nào được tạo.'
            : 'This batch was already confirmed earlier. No duplicate jobs were created.'
        );
      } else {
        setGlobalMessage(
          language === 'vi'
            ? `Đã xử lý controlled bulk publish cho ${result.createdPostIds.length} post an toàn. Chỉ các job queued chưa bắt đầu mới có thể bị hủy. Published Facebook posts are not deleted remotely.`
            : `Controlled bulk publish processed ${result.createdPostIds.length} posts safely. Only queued jobs that have not started can be cancelled. Published Facebook posts are not deleted remotely.`
        );
      }

      setShowBulkPublishModal(false);
      resetBulkPublishModalState();
      setBulkProgressRefreshTick((value) => value + 1);
    } finally {
      setBulkPublishSubmitting(false);
    }
  }

  return (
    <div className="so9-page">
      <section className="so9-hero-card">
        <p className="so9-hero-kicker">{language === 'vi' ? 'Đăng hàng loạt · channel-first workflow' : 'Bulk create · channel-first workflow'}</p>
        <div className="so9-responsive-stack mt-3">
          <div className="min-w-0">
            <h1 className="so9-hero-title">
              {language === 'vi' ? 'Đăng hàng loạt' : 'Bulk Create'}
            </h1>
            <p className="so9-hero-description">
              {language === 'vi'
                ? 'Chuẩn bị nhiều bản nháp cục bộ hoặc bài đã lên lịch theo từng kênh Facebook, với nhiều ảnh hoặc một video cho từng dòng, review eligibility rõ ràng và lớp an toàn queue-backed trước khi tạo job.'
                : 'Prepare multiple local drafts or scheduled posts per Facebook channel, with multiple images or one video per row, clear eligibility review, and queue-backed safety before any job is created.'}
            </p>
            <div className="so9-hero-actions">
              <div className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                {language === 'vi' ? `Kênh khả dụng: ${facebookPages.length}` : `Available channels: ${facebookPages.length}`}
              </div>
              <div className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                {language === 'vi' ? `Dòng đang soạn: ${actionableRows.length}` : `Rows in progress: ${actionableRows.length}`}
              </div>
              <div className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                {language === 'vi'
                  ? 'Video hàng loạt: lưu/lên lịch cục bộ'
                  : 'Bulk video: local draft/schedule'}
              </div>
            </div>
          </div>
          <div className="so9-page-actions">
            <Button type="button" variant="outline" className="rounded-full border-white/25 bg-white/10 text-white hover:bg-white/16" onClick={addRow} disabled={submitting}>
              <Plus className="mr-2 h-4 w-4" />
              {language === 'vi' ? 'Thêm dòng' : 'Add Row'}
            </Button>
            <Button
              className="rounded-full bg-white text-[#12338f] hover:bg-[#f5f8ff]"
              onClick={handleBulkSave}
              disabled={!!saveDisabledReason || bulkPublishSubmitting}
            >
              <Save className="mr-2 h-4 w-4" />
              {language === 'vi' ? 'Lưu các dòng' : 'Save rows'}
            </Button>
          </div>
        </div>
      </section>

      {globalMessage && (
        <section className="so9-banner so9-banner-info">
          <div>
            <p className="font-semibold">{language === 'vi' ? 'Cập nhật hàng loạt' : 'Bulk update'}</p>
            <p className="mt-1 text-sm">{globalMessage}</p>
          </div>
        </section>
      )}

      <Card className="so9-flat-card">
        <CardHeader className="border-b border-[#e8eef8]">
          <CardTitle>{language === 'vi' ? 'Quy tắc chọn kênh' : 'Channel selection rule'}</CardTitle>
          <CardDescription>
            {language === 'vi'
              ? 'Mỗi dòng phải tự chọn một kênh đăng rõ ràng. Không còn kênh mặc định hoặc tự động gán Trang đầu tiên.'
              : 'Each row must explicitly choose a publishing channel. There is no default channel and no automatic first-Page fallback.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="so9-state-inline p-3 text-sm">
              <p className="font-medium">{language === 'vi' ? 'Tổng số kênh' : 'Total channels'}</p>
              <p className="text-muted-foreground">{facebookPages.length}</p>
            </div>
            <div className="so9-state-inline p-3 text-sm">
              <p className="font-medium">{language === 'vi' ? 'Dòng chưa chọn kênh' : 'Rows without a channel'}</p>
              <p className="text-muted-foreground">
                {validatedRows.filter((row) => !isRowEmpty(row) && !row.targetPageId.trim()).length}
              </p>
            </div>
            <div className="so9-state-inline p-3 text-sm">
              <p className="font-medium">{language === 'vi' ? 'Hành động nhanh' : 'Quick action'}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => navigate('/connected-channels')}
              >
                {language === 'vi' ? 'Mở Kết nối kênh' : 'Open Connected Channels'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="so9-flat-card">
        <CardHeader className="border-b border-[#e8eef8]">
          <CardTitle>{language === 'vi' ? 'Dán dữ liệu nhập' : 'Paste Import'}</CardTitle>
          <CardDescription>
            {language === 'vi'
              ? 'Dán các dòng kiểu CSV, review mapping kênh/media rồi lưu thủ công. Cột hỗ trợ: title, content, pageName hoặc pageId, scheduleTime, status'
              : 'Paste CSV-like rows, review channel/media mapping, then save manually. Supported columns: title, content, pageName or pageId, scheduleTime, status'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setShowImportArea((prev) => !prev)}>
              <Upload className="mr-2 h-4 w-4" />
              {showImportArea
                ? language === 'vi' ? 'Ẩn vùng dán nhập' : 'Hide Paste Import'
                : language === 'vi' ? 'Mở vùng dán nhập' : 'Open Paste Import'}
            </Button>
            <Button type="button" variant="outline" onClick={handleImportCsvFile}>
              <Upload className="mr-2 h-4 w-4" />
              {language === 'vi' ? 'Nhập tệp CSV' : 'Import CSV File'}
            </Button>
          </div>

          {showImportArea && (
            <div className="space-y-3">
              <div className="so9-state-inline p-3 text-xs text-muted-foreground">
                {language === 'vi' ? 'Ví dụ:' : 'Example:'}
                <pre className="mt-2 whitespace-pre-wrap">
{`title,content,pageName,scheduleTime,status
Morning update,Hello team,My Page,2026-06-13 09:00,scheduled
Quick draft,This is a draft,My Page,,draft`}
                </pre>
              </div>

              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={language === 'vi' ? 'Dán các dòng kiểu CSV vào đây...' : 'Paste CSV-like rows here...'}
                className="min-h-[180px]"
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => parseImportText()}
                disabled={!importText.trim()}
              >
                {language === 'vi' ? 'Xem trước dữ liệu nhập' : 'Preview Import'}
              </Button>

              {importPreview && (
                <div className="so9-surface p-3 text-sm">
                  {lastImportedFileName ? (
                    <p className="mb-2 text-muted-foreground">
                      {language === 'vi' ? 'Tệp đã nhập' : 'Imported file'}: {lastImportedFileName}
                    </p>
                  ) : null}
                  <p>{language === 'vi' ? 'Tổng số dòng' : 'Total rows'}: {importPreview.totalRows}</p>
                  <p>{language === 'vi' ? 'Số dòng đã nhập' : 'Imported rows'}: {importPreview.importedRows}</p>
                  <p>{language === 'vi' ? 'Dòng có media' : 'Rows with media'}: {importPreview.mediaRows}</p>
                  <p>{language === 'vi' ? 'Dòng có lỗi xác thực' : 'Rows with validation issues'}: {importPreview.failedRows}</p>
                  <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                    {importPreview.messages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="so9-flat-card">
        <CardHeader className="border-b border-[#e8eef8]">
          <CardTitle>{language === 'vi' ? 'Tóm tắt kiểm tra' : 'Review Summary'}</CardTitle>
          <CardDescription>
            {language === 'vi'
              ? 'Kiểm tra nhanh số dòng, mức sẵn sàng, phân bố kênh và khoảng thời gian trước khi lưu hoặc review controlled publish.'
              : 'Quickly review row volume, readiness, channel distribution, and schedule range before saving or opening controlled publish review.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="so9-state-inline p-3 text-sm">
            <p className="font-medium">{language === 'vi' ? 'Dòng' : 'Rows'}</p>
            <p className="text-muted-foreground">{language === 'vi' ? 'Tổng' : 'Total'}: {rows.length}</p>
            <p className="text-muted-foreground">{language === 'vi' ? 'Đang hoạt động' : 'Active'}: {actionableRows.length}</p>
          </div>
          <div className="so9-state-inline p-3 text-sm">
            <p className="font-medium">{language === 'vi' ? 'Xác thực' : 'Validation'}</p>
            <p className="text-muted-foreground">{language === 'vi' ? 'Hợp lệ' : 'Valid'}: {validRows.length}</p>
            <p className="text-muted-foreground">{language === 'vi' ? 'Không hợp lệ' : 'Invalid'}: {invalidRows.length}</p>
          </div>
          <div className="so9-state-inline p-3 text-sm">
            <p className="font-medium">{language === 'vi' ? 'Phân tách trạng thái' : 'Status split'}</p>
            <p className="text-muted-foreground">{language === 'vi' ? 'Nháp' : 'Drafts'}: {draftRows.length}</p>
            <p className="text-muted-foreground">{language === 'vi' ? 'Đã lên lịch' : 'Scheduled'}: {scheduledRows.length}</p>
            <p className="text-muted-foreground">{language === 'vi' ? 'Dòng có ảnh' : 'Rows with images'}: {mediaRows.length}</p>
          </div>
          <div className="so9-state-inline p-3 text-sm md:col-span-2">
            <p className="font-medium">{language === 'vi' ? 'Phân bố theo Trang' : 'Page distribution'}</p>
            {pageDistribution.length > 0 ? (
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {pageDistribution.map(([pageName, count]) => (
                  <li key={pageName}>
                    {pageName}: {count}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{language === 'vi' ? 'Chưa có gán Trang hợp lệ.' : 'No valid Page assignments yet.'}</p>
            )}
          </div>
          <div className="so9-state-inline p-3 text-sm">
            <p className="font-medium">{language === 'vi' ? 'Khoảng thời gian lên lịch' : 'Schedule range'}</p>
            <p className="text-muted-foreground">
              {language === 'vi' ? 'Sớm nhất' : 'Earliest'}: {scheduleDates.earliest ? scheduleDates.earliest.toLocaleString() : '—'}
            </p>
            <p className="text-muted-foreground">
              {language === 'vi' ? 'Muộn nhất' : 'Latest'}: {scheduleDates.latest ? scheduleDates.latest.toLocaleString() : '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="so9-flat-card">
        <CardHeader className="border-b border-[#e8eef8]">
          <CardTitle>{language === 'vi' ? 'Các dòng' : 'Rows'}</CardTitle>
          <CardDescription>
            {language === 'vi'
              ? 'Mỗi dòng phải tự chọn kênh đăng, có thể chọn định dạng Bài viết/Tin, đính kèm nhiều ảnh hoặc một video, rồi chọn trạng thái nháp/đã lên lịch. Các dòng trống sẽ bị bỏ qua.'
              : 'Each row must explicitly choose a publishing channel, can select Post/Story format, attach multiple images or one video, and choose draft/scheduled status. Empty rows are ignored.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {validatedRows.map((row, index) => (
            <div key={row.id} className="so9-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">#{index + 1}</Badge>
                    <Badge variant={row.postStatus === 'scheduled' ? 'secondary' : 'outline'}>
                      {row.postStatus === 'scheduled'
                        ? language === 'vi'
                          ? 'đã lên lịch'
                          : 'scheduled'
                        : language === 'vi'
                          ? 'nháp'
                          : 'draft'}
                    </Badge>
                    {row.saveState === 'saved' && <Badge>{language === 'vi' ? 'đã lưu' : 'saved'}</Badge>}
                    {row.saveState === 'saving' && <Badge variant="secondary">{language === 'vi' ? 'đang lưu' : 'saving'}</Badge>}
                    {row.saveState === 'error' && <Badge variant="destructive">{language === 'vi' ? 'lỗi' : 'error'}</Badge>}
                    {!row.validationError && row.saveState === 'idle' && !isRowEmpty(row) ? (
                      <Badge variant="outline">{language === 'vi' ? 'sẵn sàng review' : 'ready for review'}</Badge>
                    ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  disabled={submitting || row.saveState === 'saving'}
                  title={language === 'vi' ? 'Xóa dòng' : 'Remove row'}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="rounded-[22px] border border-[#d9e7ff] bg-[#f5f9ff] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#17233b]">
                        {language === 'vi' ? '1. Kênh đăng' : '1. Publishing channel'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {language === 'vi'
                          ? 'Mỗi dòng phải chọn rõ một kênh trước khi lưu, lên lịch hoặc review controlled publish.'
                          : 'Every row must explicitly choose one channel before saving, scheduling, or controlled-publish review.'}
                      </p>
                    </div>
                    {!row.targetPageId ? (
                      <Badge variant="destructive" className="normal-case tracking-normal">
                        {language === 'vi' ? 'Chưa chọn kênh đăng' : 'No publishing channel selected'}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`row-page-${row.id}`}>{language === 'vi' ? 'Chọn Trang / kênh' : 'Choose Page / channel'}</Label>
                    <select
                      id={`row-page-${row.id}`}
                      className="w-full rounded-xl border bg-white px-3 py-3 text-sm"
                      value={row.targetPageId}
                      onChange={(e) => updateRow(row.id, { targetPageId: e.target.value })}
                      disabled={submitting}
                    >
                      <option value="">{language === 'vi' ? 'Chọn Trang đích' : 'Select target Page'}</option>
                      {facebookPages.map((page) => (
                        <option key={`${row.id}-${page.pageId}`} value={page.pageId}>
                          {page.pageName ?? 'Unnamed Facebook Page'} · {maskIdentifier(page.pageId)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`row-title-${row.id}`}>Title</Label>
                    <Input
                      id={`row-title-${row.id}`}
                      value={row.title}
                      onChange={(e) => updateRow(row.id, { title: e.target.value })}
                      placeholder="Optional title"
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`row-status-${row.id}`}>{language === 'vi' ? 'Trạng thái dòng' : 'Row status'}</Label>
                    <select
                      id={`row-status-${row.id}`}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={row.postStatus}
                      onChange={(e) =>
                        updateRow(row.id, {
                          postStatus: e.target.value as RowPostStatus,
                        })
                      }
                      disabled={submitting}
                    >
                      <option value="draft">{language === 'vi' ? 'nháp' : 'draft'}</option>
                      <option value="scheduled">{language === 'vi' ? 'đã lên lịch' : 'scheduled'}</option>
                    </select>
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor={`row-content-${row.id}`}>{language === 'vi' ? 'Nội dung' : 'Content'}</Label>
                    <Textarea
                      id={`row-content-${row.id}`}
                      value={row.content}
                      onChange={(e) => updateRow(row.id, { content: e.target.value })}
                      placeholder={language === 'vi' ? 'Nhập nội dung bài viết ở đây...' : 'Write post content here...'}
                      className="min-h-[120px]"
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-3 lg:col-span-2">
                    <Label>{language === 'vi' ? '3. Media cho dòng này' : '3. Media for this row'}</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void attachMediaToRow(row.id)}
                        disabled={submitting || row.saveState === 'saving'}
                      >
                        <ImagePlus className="mr-2 h-4 w-4" />
                        {row.media.images.length > 0
                          ? language === 'vi'
                            ? 'Thay / thêm media'
                            : 'Replace / add media'
                          : language === 'vi'
                            ? 'Thêm media'
                            : 'Add media'}
                      </Button>
                      {row.media.images.length > 0 || row.media.video ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMediaFromRow(row.id)}
                          disabled={submitting || row.saveState === 'saving'}
                        >
                          <X className="mr-2 h-4 w-4" />
                          {language === 'vi' ? 'Gỡ media' : 'Remove media'}
                        </Button>
                      ) : null}
                    </div>

                    {row.media.images.length > 0 ? (
                      <div className="so9-surface p-3">
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md border bg-muted/20 p-2">
                            {row.media.images[0]?.previewUrl ? (
                              <img
                                src={row.media.images[0].previewUrl}
                                alt={language === 'vi' ? 'Xem trước ảnh của dòng' : 'Row image preview'}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <div className="text-center text-xs text-muted-foreground">
                                {language === 'vi' ? 'Cần đính kèm lại' : 'Needs reattach'}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1 text-sm">
                            <p className="truncate font-medium">{row.media.images[0]?.fileName}</p>
                            <p className="text-muted-foreground">
                              {language === 'vi' ? 'Kích thước' : 'Size'}: {formatFileSize(row.media.images[0]?.fileSizeBytes ?? 0, language)}
                            </p>
                            <p className="text-muted-foreground">
                              MIME: {row.media.images[0]?.mimeType ?? '—'}
                            </p>
                            {row.media.images[0]?.importedFromCsv ? (
                              <p className="text-muted-foreground">
                                {language === 'vi' ? 'Nguồn: cột media của CSV' : 'Source: CSV media column'}
                              </p>
                            ) : null}
                            {row.media.images[0]?.needsReattach ? (
                              <div className="flex items-center gap-2 text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <span>
                                  {language === 'vi'
                                    ? 'Không tìm thấy tệp ảnh. Vui lòng đính kèm lại ảnh.'
                                    : 'Image file not found. Please reattach the image.'}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="so9-empty-state px-3 py-2 text-sm text-muted-foreground">
                        {language === 'vi'
                          ? 'Chưa có media. Dòng này có thể dùng nhiều ảnh hoặc đúng một video. Không thể trộn ảnh và video trong cùng một dòng.'
                          : 'No media selected yet. This row can use multiple images or exactly one video. Images and video cannot be mixed in the same row.'}
                      </div>
                    )}
                  </div>

                  {row.postStatus === 'scheduled' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor={`row-date-${row.id}`}>{language === 'vi' ? 'Ngày lên lịch' : 'Schedule date'}</Label>
                        <Input
                          id={`row-date-${row.id}`}
                          type="date"
                          value={row.scheduledDate}
                          onChange={(e) => updateRow(row.id, { scheduledDate: e.target.value })}
                          disabled={submitting}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`row-time-${row.id}`}>{language === 'vi' ? 'Giờ lên lịch' : 'Schedule time'}</Label>
                        <Input
                          id={`row-time-${row.id}`}
                          type="time"
                          value={row.scheduledTime}
                          onChange={(e) => updateRow(row.id, { scheduledTime: e.target.value })}
                          disabled={submitting}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {(row.validationError || row.saveError) && (
                <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {row.validationError ?? row.saveError}
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={submitting}>
              <Plus className="mr-2 h-4 w-4" />
              {language === 'vi' ? 'Thêm dòng' : 'Add Row'}
            </Button>

            {saveDisabledReason && (
              <p className="text-sm text-muted-foreground">{saveDisabledReason}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="so9-flat-card">
          <CardHeader className="border-b border-[#e8eef8]">
            <CardTitle>{language === 'vi' ? 'Chốt an toàn cho đăng hàng loạt' : 'Bulk Publish Safety Gate'}</CardTitle>
            <CardDescription>
              {language === 'vi'
                ? 'Xem eligibility theo từng dòng, xác nhận thủ công và chỉ cho phép tiếp tục khi điều kiện an toàn của kênh, media và runtime đạt yêu cầu.'
                : 'Review per-row eligibility, confirm manually, and continue only when channel, media, and runtime safety requirements are satisfied.'}
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-4">
          {publishingModeStatus === 'loading' ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              {language === 'vi'
                ? 'Đang kiểm tra chế độ đăng Facebook...'
                : 'Checking Facebook publishing mode...'}
            </div>
          ) : publishingModeStatus === 'error' ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {language === 'vi'
                ? 'Không thể xác minh chế độ đăng Facebook. Đăng thật hàng loạt bị chặn cho đến khi trạng thái cấu hình tải thành công.'
                : 'Unable to verify Facebook publishing mode. Bulk real publish is blocked until config status loads successfully.'}
            </div>
          ) : realPublishingEnabled ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">
                {language === 'vi'
                  ? 'Đăng thật Facebook có kiểm soát đang BẬT.'
                  : 'Controlled real Facebook publishing is ENABLED.'}
              </p>
              <p className="mt-1">
                {language === 'vi'
                  ? `Bulk Create sẽ tạo post queued qua queue hiện có sau xác nhận. Mỗi controlled bulk publish batch bị giới hạn tối đa ${CONTROLLED_BULK_PUBLISH_BATCH_LIMIT} post.`
                  : `Bulk Create will create queued posts through the existing queue after confirmation. Each controlled bulk publish batch is limited to ${CONTROLLED_BULK_PUBLISH_BATCH_LIMIT} posts.`}
              </p>
            </div>
          ) : (
            <div
              className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
              data-testid="bulk-create-real-publish-disabled-message"
            >
              <p className="font-medium">
                {language === 'vi'
                  ? 'Đăng thật hàng loạt đang bị tắt.'
                  : 'Bulk real publishing is disabled.'}
              </p>
              <p className="mt-1">{bulkPublishBlockedMessage}</p>
            </div>
          )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="so9-state-inline p-3 text-sm">
              <p className="font-medium">{language === 'vi' ? 'Tổng số dòng đã chọn để review' : 'Total rows selected for review'}</p>
              <p className="text-muted-foreground">{eligibilityReviewRows.length}</p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{language === 'vi' ? 'Phân bố theo Trang' : 'Page distribution'}</p>
              <p className="text-muted-foreground">{pageDistribution.length}</p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{language === 'vi' ? 'Bài text-only / bài có ảnh' : 'Text-only / image posts'}</p>
              <p className="text-muted-foreground">
                {selectedTextOnlyRows.length} / {selectedImageRows.length}
              </p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{language === 'vi' ? 'Đã lên lịch / ngay lập tức' : 'Scheduled / immediate'}</p>
              <p className="text-muted-foreground">
                {selectedScheduledRows.length} / {selectedImmediateRows.length}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{language === 'vi' ? 'Eligible' : 'Eligible'}</p>
              <p className="text-muted-foreground">{eligibleBulkRows.length}</p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{language === 'vi' ? 'Không hợp lệ' : 'Invalid / blocked'}</p>
              <p className="text-muted-foreground">{ineligibleBulkRows.length}</p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{language === 'vi' ? 'Dòng invalid' : 'Invalid rows'}</p>
              <p className="text-muted-foreground">{invalidRows.length}</p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{language === 'vi' ? 'Nháp / lưu cục bộ' : 'Draft / local save count'}</p>
              <p className="text-muted-foreground">{immediateRows.length}</p>
            </div>
          </div>

          {eligibilityReviewRows.length > 0 ? (
            <div className="so9-surface p-4" data-testid="bulk-create-progress-panel">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{language === 'vi' ? 'Eligibility review' : 'Eligibility review'}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'vi'
                      ? 'Các dòng không đủ điều kiện sẽ hiển thị lý do rõ ràng trước khi xác nhận. Không có queue creation nào diễn ra ở bước review này.'
                      : 'Ineligible rows show explicit reasons before confirmation. No queue creation happens during this review step.'}
                  </p>
                </div>
                <Badge variant="outline">
                  {language === 'vi' ? 'Eligible' : 'Eligible'}: {eligibleBulkRows.length}/{eligibilityReviewRows.length}
                </Badge>
              </div>

              <div className="space-y-2">
                {eligibilityReviewRows.map((row) => (
                  <div
                    key={`bulk-review-${row.rowId}`}
                    className={`rounded-md border p-3 text-sm ${
                      row.isEligible
                        ? 'border-emerald-300 bg-emerald-50/60'
                        : 'border-destructive/30 bg-destructive/5'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">
                          #{row.rowIndex} · {row.title}
                        </p>
                        <p className="text-muted-foreground">
                          {row.targetPageLabel} · {row.postStatus === 'scheduled'
                            ? language === 'vi'
                              ? 'đã lên lịch'
                              : 'scheduled'
                            : language === 'vi'
                              ? 'ngay lập tức'
                              : 'immediate'}
                          {' · '}
                          {row.hasImage
                            ? language === 'vi'
                              ? 'có ảnh'
                              : 'image'
                            : language === 'vi'
                              ? 'text-only'
                              : 'text-only'}
                        </p>
                      </div>
                      <Badge variant={row.isEligible ? 'default' : 'destructive'}>
                        {row.isEligible
                          ? language === 'vi'
                            ? 'đủ điều kiện'
                            : 'eligible'
                          : language === 'vi'
                            ? 'bị chặn'
                            : 'blocked'}
                      </Badge>
                    </div>
                    {!row.isEligible && row.reason ? (
                      <p className="mt-2 text-destructive">{row.reason}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {bulkPublishProgress ? (
            <div className="so9-surface p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{language === 'vi' ? 'Tiến độ bulk publish' : 'Bulk publish progress'}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'vi'
                      ? 'Trạng thái bên dưới phản ánh queue thật của controlled bulk publish. Không có Graph call trực tiếp từ UI.'
                      : 'The statuses below reflect the real queue-backed controlled bulk publish flow. No direct Graph call is made from the UI.'}
                  </p>
                </div>
                <Badge variant="outline">{bulkPublishProgress.executionMode}</Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
                <div className="so9-state-inline p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Đã chọn' : 'Selected'}</p>
                  <p className="text-muted-foreground">{bulkPublishProgress.selectedCount}</p>
                </div>
                <div className="so9-state-inline p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Eligible' : 'Eligible'}</p>
                  <p className="text-muted-foreground">{bulkPublishProgress.eligibleCount}</p>
                </div>
                <div className="so9-state-inline p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Đã xếp hàng' : 'Queued'}</p>
                  <p className="text-muted-foreground">{bulkPublishProgress.queuedCount}</p>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Đang đăng' : 'Posting'}</p>
                  <p className="text-muted-foreground">{bulkPublishProgress.postingCount}</p>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Đã publish' : 'Published'}</p>
                  <p className="text-muted-foreground">{bulkPublishProgress.publishedCount}</p>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Failed' : 'Failed'}</p>
                  <p className="text-muted-foreground">{bulkPublishProgress.failedCount}</p>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Blocked' : 'Blocked'}</p>
                  <p className="text-muted-foreground">{bulkPublishProgress.blockedCount}</p>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Cancelled' : 'Cancelled'}</p>
                  <p className="text-muted-foreground">{bulkPublishProgress.cancelledCount}</p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {bulkPublishProgress.results.map((result) => (
                  <div key={`bulk-progress-${result.rowId}`} className="so9-surface p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          #{result.rowIndex} · {result.title}
                          {typeof result.postId === 'number' ? ` · #${result.postId}` : ''}
                        </p>
                        <p className="mt-1 text-muted-foreground">{result.message}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            result.status === 'published' || result.status === 'queued' || result.status === 'posting'
                              ? 'default'
                              : result.status === 'cancelled'
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {result.status}
                        </Badge>
                        {result.canCancelBeforeStart && typeof result.postId === 'number' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => void handleCancelQueuedBulkPost(result.postId!)}
                          >
                            {language === 'vi' ? 'Hủy trước khi bắt đầu' : 'Cancel before start'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  type="button"
                  disabled={createdPostIds.length === 0}
                  onClick={() => navigate(`/posts?createdPostIds=${createdPostIds.join(',')}`)}
                >
                  {language === 'vi' ? 'Xem trong Bài viết' : 'View in Posts'}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {language === 'vi'
                    ? 'Chỉ các job queued chưa bắt đầu mới có thể bị hủy. Published Facebook posts are not deleted remotely.'
                    : 'Only queued jobs that have not started can be cancelled. Published Facebook posts are not deleted remotely.'}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button className="flex-1" onClick={handleBulkSave} disabled={!!saveDisabledReason || bulkPublishSubmitting}>
              <Save className="mr-2 h-4 w-4" />
              {language === 'vi' ? 'Lưu các dòng hàng loạt' : 'Save Bulk Rows'}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={createdPostIds.length === 0}
              onClick={() => navigate(`/posts?createdPostIds=${createdPostIds.join(',')}`)}
            >
              {language === 'vi' ? 'Xem các bài viết đã tạo' : 'View created posts'}
            </Button>
            <Button variant="outline" type="button" disabled={bulkPublishSubmitting}>
              <CalendarClock className="mr-2 h-4 w-4" />
              {language === 'vi' ? 'Chỉ tạo nháp cục bộ / bài viết đã lên lịch' : 'Local drafts/scheduled posts only'}
            </Button>
            <Button
              variant="destructive"
              type="button"
              data-testid="bulk-create-open-bulk-publish-review"
              onClick={handleOpenBulkPublishModal}
              disabled={bulkPublishSubmitting || !!bulkPublishDisabledReason}
              title={bulkPublishDisabledReason ?? undefined}
            >
              {bulkPublishSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {language === 'vi' ? 'Bulk Real Publish' : 'Bulk Real Publish'}
            </Button>
          </div>
          {bulkPublishDisabledReason ? (
            <p className="text-sm text-muted-foreground">{bulkPublishDisabledReason}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {language === 'vi'
                ? 'Không có publish nào diễn ra trước khi xác nhận thủ công trong modal.'
                : 'No publish occurs before manual confirmation in the modal.'}
            </p>
          )}

          {showBulkPublishModal ? (
            <div
              className="so9-modal-card border border-foreground/10 bg-background p-4 shadow-sm"
              data-testid="bulk-create-bulk-publish-modal"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">
                    {language === 'vi'
                      ? 'Xác nhận đăng thật hàng loạt có kiểm soát'
                      : 'Controlled Bulk Real Publish Confirmation'}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {language === 'vi'
                      ? 'Đây là bước xác nhận cuối cùng trước khi tạo queued jobs qua queue hiện có. Không có Graph call trực tiếp từ modal này.'
                      : 'This is the final confirmation step before queued jobs are created through the existing queue. No direct Graph call is made from this modal.'}
                  </p>
                </div>
                <Button variant="ghost" size="icon" type="button" onClick={handleCloseBulkPublishModal} disabled={bulkPublishSubmitting}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="so9-state-inline p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Tổng số bài đã chọn' : 'Total selected posts'}</p>
                  <p className="text-muted-foreground">{eligibilityReviewRows.length}</p>
                </div>
                <div className="so9-state-inline p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Phân bố theo Trang' : 'Page distribution'}</p>
                  <p className="text-muted-foreground">{pageDistribution.length}</p>
                </div>
                <div className="so9-state-inline p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Text-only / ảnh' : 'Text-only / images'}</p>
                  <p className="text-muted-foreground">{selectedTextOnlyRows.length} / {selectedImageRows.length}</p>
                </div>
                <div className="so9-state-inline p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Đã lên lịch / ngay lập tức' : 'Scheduled / immediate'}</p>
                  <p className="text-muted-foreground">{selectedScheduledRows.length} / {selectedImmediateRows.length}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="so9-state-inline p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Dòng invalid' : 'Invalid row count'}</p>
                  <p className="text-muted-foreground">{ineligibleBulkRows.length}</p>
                </div>
                <div className="so9-state-inline p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Eligible / blocked' : 'Eligible / blocked'}</p>
                  <p className="text-muted-foreground">{eligibleBulkRows.length} / {ineligibleBulkRows.length}</p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <p className="font-medium text-destructive">
                  {language === 'vi'
                  ? 'Cảnh báo: các bài đăng thật sẽ được xếp hàng để publish lên Facebook sau khi bạn xác nhận controlled bulk publish.'
                  : 'Warning: real posts will be queued for Facebook publishing after you confirm controlled bulk publish.'}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>
                    {language === 'vi'
                      ? 'Ứng dụng này không thực hiện remote undo/delete cho bài đã publish.'
                      : 'This app does not perform remote undo/delete for published posts.'}
                  </li>
                  <li>
                    {language === 'vi'
                      ? 'Xóa cục bộ không xóa bài viết Facebook.'
                      : 'Local delete does not delete Facebook posts.'}
                  </li>
                  <li>
                    {language === 'vi'
                      ? 'Không bao giờ coi fb_sim_* là thành công Facebook thật.'
                      : 'fb_sim_* is never treated as real Facebook success.'}
                  </li>
                </ul>
              </div>

              <div className="mt-4 space-y-4">
                <label className="so9-surface flex items-start gap-3 p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    data-testid="bulk-create-bulk-publish-confirm-checkbox"
                    checked={bulkConfirmChecked}
                    onChange={(e) => setBulkConfirmChecked(e.target.checked)}
                    disabled={bulkPublishSubmitting}
                  />
                  <span>
                    {language === 'vi'
                      ? 'Tôi hiểu rằng thao tác này sẽ publish các bài đăng thật lên Facebook.'
                      : 'I understand this will publish real posts to Facebook.'}
                  </span>
                </label>

                <div className="space-y-2">
                  <Label htmlFor="bulk-confirm-publish">PUBLISH</Label>
                  <Input
                    id="bulk-confirm-publish"
                    data-testid="bulk-create-bulk-publish-confirm-input"
                    value={bulkConfirmText}
                    onChange={(e) => setBulkConfirmText(e.target.value)}
                    placeholder={language === 'vi' ? 'Gõ PUBLISH để xác nhận' : 'Type PUBLISH to confirm'}
                    disabled={bulkPublishSubmitting}
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button variant="outline" type="button" onClick={handleCloseBulkPublishModal} disabled={bulkPublishSubmitting}>
                    {language === 'vi' ? 'Hủy' : 'Cancel'}
                  </Button>
                  <Button
                    variant="destructive"
                    type="button"
                    data-testid="bulk-create-bulk-publish-confirm-button"
                    onClick={() => void handleConfirmControlledBulkPublish()}
                    disabled={!bulkPublishConfirmReady || bulkPublishSubmitting}
                  >
                    {bulkPublishSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    {language === 'vi'
                      ? 'Xác nhận controlled bulk publish'
                      : 'Confirm controlled bulk publish'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}