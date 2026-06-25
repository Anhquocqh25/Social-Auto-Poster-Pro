import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  FileText,
  Plus,
  Search,
  Calendar,
  Eye,
  Copy,
  Trash2,
  Send,
  X,
  XCircle,
  Save,
  RefreshCw,
  ArrowRightCircle,
  Loader2,
} from 'lucide-react';
import type {
  BulkPublishEligibilityReason,
  BulkPublishPrepareRowPayload,
  PostSnapshot,
  PostTargetSnapshot,
} from '@/types/electron';
import { getElectronAPI } from '@/lib/electronApi';
import {
  buildEditableFacebookPageTargets,
  getUniqueTargetAccountsFromPageTargets,
} from '@/lib/facebookPageTargetRouting';
import { t } from '@/lib/i18n';
import { useLanguageStore } from '@/store/useLanguageStore';

const statusColors = {
  draft: 'secondary',
  scheduled: 'warning',
  queued: 'secondary',
  posting: 'default',
  published: 'success',
  partially_failed: 'destructive',
  failed: 'destructive',
  cancelled: 'outline',
  blocked: 'outline',
  unknown: 'outline',
  needs_verification: 'warning',
} as const;

const CONTROLLED_BULK_PUBLISH_BATCH_LIMIT = 3;

function statusLabel(status: string, language: 'vi' | 'en') {
  const labels: Record<string, { vi: string; en: string }> = {
    draft: { vi: 'Nháp', en: 'Draft' },
    scheduled: { vi: 'Đã lên lịch', en: 'Scheduled' },
    queued: { vi: 'Đã xếp hàng', en: 'Queued' },
    posting: { vi: 'Đang đăng', en: 'Posting' },
    published: { vi: 'Đã đăng', en: 'Published' },
    partially_failed: { vi: 'Thất bại một phần', en: 'Partially Failed' },
    failed: { vi: 'Thất bại', en: 'Failed' },
    cancelled: { vi: 'Đã hủy', en: 'Cancelled' },
    blocked: { vi: 'Bị chặn', en: 'Blocked' },
    unknown: { vi: 'Không rõ', en: 'Unknown' },
    needs_verification: { vi: 'Cần xác minh', en: 'Needs Verification' },
  };

  return labels[status]?.[language] ?? status;
}

interface PersistedBulkReviewRow {
  clientRowId: string;
  existingPostId: number;
  title: string;
  contentPreview: string;
  status: string;
  targetPageLabel: string;
  mediaType: string;
  hasImage: boolean;
  createdAtLabel: string | null;
  scheduledAtLabel: string | null;
  isEligible: boolean;
  reasonKey: BulkPublishEligibilityReason | null;
  reason: string | null;
}

interface PersistedBulkProgressRow {
  rowId: string;
  postId: number;
  title: string;
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

interface PersistedBulkProgressSnapshot {
  selectedCount: number;
  eligibleCount: number;
  queuedCount: number;
  postingCount: number;
  publishedCount: number;
  failedCount: number;
  blockedCount: number;
  cancelledCount: number;
  results: PersistedBulkProgressRow[];
  executionMode: 'queue_backed_controlled_publish';
}

function maskIdentifier(value: string | null | undefined, language: 'vi' | 'en' = 'en') {
  if (!value) {
    return language === 'vi' ? 'Không rõ' : 'Unknown';
  }

  if (value.length <= 6) {
    return `••${value.slice(-2)}`;
  }

  return `${value.slice(0, 2)}••••${value.slice(-4)}`;
}

function getPostMediaPreviewSrc(post: PostSnapshot): string | null {
  if (post.mediaType !== 'photo') {
    return null;
  }

  if (post.mediaUrl?.trim()) {
    return post.mediaUrl;
  }

  if (post.mediaLocalPath?.trim()) {
    const normalizedPath = post.mediaLocalPath.replace(/\\/g, '/');
    return normalizedPath.startsWith('file://')
      ? normalizedPath
      : `file:///${normalizedPath}`;
  }

  return null;
}

function formatMediaFileSize(value: number | null | undefined, language: 'vi' | 'en') {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return language === 'vi' ? 'Không rõ' : 'Unknown';
  }

  if ((value ?? 0) < 1024) {
    return `${value} B`;
  }

  if ((value ?? 0) < 1024 * 1024) {
    return `${((value ?? 0) / 1024).toFixed(1)} KB`;
  }

  return `${(((value ?? 0) as number) / (1024 * 1024)).toFixed(2)} MB`;
}

function formatMediaDuration(value: number | null | undefined, language: 'vi' | 'en') {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return language === 'vi' ? 'Chưa có' : 'Not available';
  }

  const totalSeconds = Math.floor((value ?? 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getSafeMediaLabel(post: PostSnapshot, language: 'vi' | 'en') {
  if (post.mediaType === 'video') {
    return language === 'vi' ? 'Video' : 'Video';
  }

  if (post.mediaType === 'photo') {
    return language === 'vi' ? 'Ảnh' : 'Image';
  }

  return language === 'vi' ? 'Không có media' : 'No media';
}

function getPrimaryTarget(post: PostSnapshot): PostTargetSnapshot | null {
   if (!post.postTargets?.length) {
     return null;
   }
 
   const pageTarget = post.postTargets.find((target) => target.targetType === 'page');
   return pageTarget ?? post.postTargets[0];
 }
 
function isSimulationPost(post: PostSnapshot): boolean {
   return !!post.postTargets?.some((target) => target.accountPlatformId.startsWith('mock_'));
 }
 
function isRealFacebookPost(post: PostSnapshot): boolean {
   return !!post.postTargets?.some(
     (target) => target.platform === 'facebook' && !target.accountPlatformId.startsWith('mock_')
   );
 }

export function PostsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const electronAPI = getElectronAPI();
  const { language } = useLanguageStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('all');
  const [posts, setPosts] = useState<PostSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [realPublishingEnabled, setRealPublishingEnabled] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostSnapshot | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [openedFromDiagnostics, setOpenedFromDiagnostics] = useState(false);
  const [createdPostIdFilter, setCreatedPostIdFilter] = useState<number[]>([]);
  const [selectedPersistedPostIds, setSelectedPersistedPostIds] = useState<number[]>([]);
  const [persistedBulkPreparedRows, setPersistedBulkPreparedRows] = useState<PersistedBulkReviewRow[]>([]);
  const [showPersistedBulkPublishModal, setShowPersistedBulkPublishModal] = useState(false);
  const [persistedBulkConfirmChecked, setPersistedBulkConfirmChecked] = useState(false);
  const [persistedBulkConfirmText, setPersistedBulkConfirmText] = useState('');
  const [persistedBulkConfirmationToken, setPersistedBulkConfirmationToken] = useState<string | null>(null);
  const [persistedBulkSubmitting, setPersistedBulkSubmitting] = useState(false);
  const [persistedBulkProgress, setPersistedBulkProgress] = useState<PersistedBulkProgressSnapshot | null>(null);
  const [persistedBulkProgressRefreshTick, setPersistedBulkProgressRefreshTick] = useState(0);
  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    hashtags: '',
    scheduledAt: '',
  });

  const loadPosts = async () => {
    try {
      setStatusMessage(null);
      const [result, connectionStatus] = await Promise.all([
        electronAPI.posts.list(),
        electronAPI.accounts.getConnectionStatus(),
      ]);
      setPosts(result.posts);
      setRealPublishingEnabled(connectionStatus.facebook.realPublishingEnabled);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : language === 'vi'
            ? 'Không thể tải danh sách bài viết'
            : 'Failed to load posts'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPosts();
  }, []);
  useEffect(() => {
    const createdPostIdsRaw = searchParams.get('createdPostIds');

    if (!createdPostIdsRaw) {
      setCreatedPostIdFilter([]);
      return;
    }

    const parsedIds = createdPostIdsRaw
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));

    setCreatedPostIdFilter(parsedIds);
  }, [searchParams]);

  useEffect(() => {
    const requestedPostId = searchParams.get('postId');
    const source = searchParams.get('source');

    if (!requestedPostId) {
      return;
    }

    const postId = Number(requestedPostId);
    if (!Number.isFinite(postId)) {
        setStatusMessage(
          language === 'vi'
            ? 'Không tìm thấy bài viết hoặc bài viết không còn tồn tại cục bộ.'
            : 'Post not found or no longer available locally.'
        );
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('postId');
        next.delete('source');
        return next;
      }, { replace: true });
      return;
    }

    void (async () => {
      await handleViewPost(postId);
      setOpenedFromDiagnostics(source === 'diagnostics');
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('postId');
        next.delete('source');
        return next;
      }, { replace: true });
    })();
  }, [searchParams]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const primaryTarget = getPrimaryTarget(post);
      const targetText = primaryTarget?.pageName ?? primaryTarget?.accountName ?? '';

      const matchesSearch =
        (post.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        targetText.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || post.status === statusFilter;

      const matchesPlatform =
        platformFilter === 'all' ||
        (platformFilter === 'simulation'
          ? post.postTargets?.some((target) => target.accountPlatformId.startsWith('mock_'))
          : post.postTargets?.some((target) => target.platform === platformFilter));

      const matchesCreatedPostFilter =
        createdPostIdFilter.length === 0 || createdPostIdFilter.includes(post.id);

      const normalizedMediaType =
        post.mediaType === 'photo' || post.mediaType === 'video' ? post.mediaType : 'none';
      const matchesMediaType = mediaTypeFilter === 'all' || normalizedMediaType === mediaTypeFilter;

      return matchesSearch && matchesStatus && !!matchesPlatform && matchesCreatedPostFilter && matchesMediaType;
    });
  }, [posts, searchQuery, statusFilter, platformFilter, createdPostIdFilter, mediaTypeFilter]);

  const selectedPersistedPosts = useMemo(
    () => posts.filter((post) => selectedPersistedPostIds.includes(post.id)),
    [posts, selectedPersistedPostIds]
  );

  const persistedBulkPreparePayload = useMemo<BulkPublishPrepareRowPayload[]>(
    () =>
      selectedPersistedPosts.map((post) => {
        const primaryTarget = getPrimaryTarget(post);
        return {
          clientRowId: `persisted-post-${post.id}`,
          title: post.title ?? undefined,
          content: post.content,
          mediaType:
            post.mediaType === 'photo' || post.mediaType === 'video' ? post.mediaType : 'none',
          mediaLocalPath: post.mediaLocalPath ?? undefined,
          targetPageId: primaryTarget?.pageId ?? undefined,
          sourceAccountId: primaryTarget?.accountId,
          postStatus: post.scheduledAt ? 'scheduled' : 'draft',
          existingPostId: post.id,
        };
      }),
    [selectedPersistedPosts]
  );

  const persistedBulkEligibleRows = persistedBulkPreparedRows.filter((row) => row.isEligible);
  const persistedBulkBlockedRows = persistedBulkPreparedRows.filter((row) => !row.isEligible);
  const persistedBulkTextOnlyCount = persistedBulkPreparedRows.filter((row) => !row.hasImage).length;
  const persistedBulkImageCount = persistedBulkPreparedRows.filter((row) => row.hasImage).length;
  const persistedBulkSelectionLimitMessage =
    language === 'vi'
      ? 'Controlled bulk publish is limited to 3 posts per batch.'
      : 'Controlled bulk publish is limited to 3 posts per batch.';
  const persistedBulkBlockedMessage =
    'Bulk real publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable controlled bulk publish.';
  const persistedBulkConfirmReady =
    persistedBulkConfirmChecked && persistedBulkConfirmText.trim() === 'PUBLISH';
  const persistedBulkPageDistribution = useMemo(() => {
    const distribution = new Map<string, number>();
    persistedBulkPreparedRows.forEach((row) => {
      distribution.set(row.targetPageLabel, (distribution.get(row.targetPageLabel) ?? 0) + 1);
    });
    return Array.from(distribution.entries());
  }, [persistedBulkPreparedRows]);

  function getBulkEligibilityReasonLabel(reason: BulkPublishEligibilityReason) {
    const labels: Record<BulkPublishEligibilityReason, string> = {
      missing_target_page:
        language === 'vi' ? 'Thiếu kênh / Trang đích.' : 'Missing target channel / Page.',
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
        language === 'vi' ? 'Đăng thật đang bị tắt.' : 'Real publish is disabled.',
      missing_source_account_id:
        language === 'vi' ? 'Thiếu source account id.' : 'Missing source account id.',
      page_readiness_failed:
        language === 'vi' ? 'Trạng thái sẵn sàng của kênh đích không đạt.' : 'Target channel readiness failed.',
      already_posting:
        language === 'vi' ? 'Đã ở trạng thái queued hoặc posting.' : 'Already queued or posting.',
      cancelled:
        language === 'vi'
          ? 'Bài viết đã hủy không thể được publish.'
          : 'Cancelled post cannot be published.',
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

  function buildPersistedBulkProgressSnapshot(
    currentResults: PersistedBulkProgressRow[],
    latestPostsById?: Map<number, PostSnapshot>
  ): PersistedBulkProgressSnapshot {
    const hydratedResults = currentResults.map((result) => {
      const latestPost = latestPostsById?.get(result.postId);

      if (!latestPost) {
        return result;
      }

      const normalizedStatus: PersistedBulkProgressRow['status'] =
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

      const message =
        latestPost.status === 'queued'
          ? language === 'vi'
            ? 'Đã xếp hàng queue an toàn cho post hiện có.'
            : 'Queued safely for the existing post.'
          : latestPost.status === 'posting'
            ? language === 'vi'
              ? 'Queue đang xử lý post hiện có.'
              : 'The queue is processing the existing post.'
            : latestPost.status === 'published'
              ? language === 'vi'
                ? 'Đã publish thành công qua queue.'
                : 'Published successfully through the queue.'
              : latestPost.status === 'cancelled'
                ? language === 'vi'
                  ? 'Đã hủy trước khi queue bắt đầu publish.'
                  : 'Cancelled before queue processing started.'
                : latestPost.errorMessage ||
                  (language === 'vi'
                    ? 'Post bị chặn hoặc thất bại trong queue.'
                    : 'The post was blocked or failed in the queue.');

      return {
        ...result,
        status: normalizedStatus,
        message,
        canCancelBeforeStart: normalizedStatus === 'queued',
      };
    });

    return {
      selectedCount: persistedBulkPreparedRows.length,
      eligibleCount: persistedBulkEligibleRows.length,
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

  const populateEditForm = (post: PostSnapshot) => {
    setEditForm({
      title: post.title ?? '',
      content: post.content,
      hashtags: post.hashtags ?? '',
      scheduledAt: post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : '',
    });
  };

  const handleViewPost = async (postId: number) => {
    try {
      console.info(`[PostsPage] open detail requested postId=${postId}`);
      setDetailLoading(true);
      setDetailError(null);
      setStatusMessage(null);
      setSelectedPost(null);

      console.info(`[PostsPage] getById start postId=${postId}`);
      const post = await electronAPI.posts.getById(postId);

      if (!post) {
        console.info(`[PostsPage] getById success postId=${postId} found=false`);
        const message =
          language === 'vi'
            ? 'Không tìm thấy bài viết hoặc bài viết không còn tồn tại cục bộ.'
            : 'Post not found or no longer available locally.';
        setDetailError(message);
        setStatusMessage(message);
        return;
      }

      console.info(`[PostsPage] getById success postId=${postId} found=true`);
      setSelectedPost(post);
      setEditMode(false);
      if (searchParams.get('source') !== 'diagnostics') {
        setOpenedFromDiagnostics(false);
      }
      populateEditForm(post);
    } catch (error) {
      const safeMessage =
        error instanceof Error
          ? error.message
          : language === 'vi'
            ? 'Không thể tải chi tiết bài viết'
            : 'Failed to load post details';
      console.info(`[PostsPage] getById error=${safeMessage}`);
      setDetailError(safeMessage);
      setStatusMessage(safeMessage);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCopyPost = async (post: PostSnapshot) => {
    try {
      await navigator.clipboard.writeText(post.content);
      setStatusMessage(
        language === 'vi'
          ? `Đã sao chép nội dung cho bài viết #${post.id}.`
          : `Copied content for post #${post.id}.`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : language === 'vi'
            ? 'Không thể sao chép nội dung bài viết'
            : 'Failed to copy post content'
      );
    }
  };

  const handleDeletePost = async (postId: number) => {
    const confirmed = window.confirm(
      language === 'vi'
        ? 'Thao tác này chỉ xóa bản ghi cục bộ. Nó không xóa bài viết trên Facebook. Tiếp tục?'
        : 'This only removes the local record. It does not delete the Facebook post. Continue?'
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await electronAPI.posts.deleteLocal(postId);
      setStatusMessage(result.message);
      if (selectedPost?.id === postId) {
        setSelectedPost(null);
        setEditMode(false);
      }
      await loadPosts();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : language === 'vi'
            ? 'Không thể xóa bài viết cục bộ'
            : 'Failed to delete local post'
      );
    }
  };

  const handlePostNow = (post: PostSnapshot) => {
    const primaryTarget = getPrimaryTarget(post);

    if (!primaryTarget) {
      setStatusMessage(
        language === 'vi'
          ? 'Không thể đăng ngay vì chưa chọn kênh đích hợp lệ.'
          : 'Cannot post now because no valid target channel is selected.'
      );
      return;
    }

    const isSimulation = primaryTarget.accountPlatformId.startsWith('mock_');
    if (isSimulation) {
      setStatusMessage(
        language === 'vi'
          ? 'Luồng đăng ngay ở chế độ mô phỏng trên trang Bài viết chưa được triển khai. Nền tảng mô phỏng hiện tại vẫn được giữ nguyên.'
          : 'Simulation post-now wiring is not yet implemented on the Posts page. Existing simulation foundations remain intact.'
      );
      return;
    }

    if (primaryTarget.platform === 'facebook') {
      if (!realPublishingEnabled) {
        setStatusMessage(
          language === 'vi'
            ? 'Đăng thật Facebook vẫn đang bị tắt. Hãy chọn một kênh Facebook rồi chỉ lưu nháp hoặc metadata lên lịch.'
            : 'Real Facebook publishing remains disabled. Select a Facebook channel and save a draft or schedule metadata only.'
        );
      } else {
        setStatusMessage(
          language === 'vi'
            ? 'Đăng thật Facebook có kiểm soát đang được BẬT cho phiên này. Hãy dùng trang Tạo bài viết để kiểm tra đăng đúng một lần.'
            : 'Controlled real Facebook publishing is ENABLED for this session. Use the Create Post page to test publishing exactly once.'
        );
      }
      return;
    }

    setStatusMessage(
      language === 'vi'
        ? 'Không thể đăng ngay vì chưa chọn kênh đích hợp lệ.'
        : 'Cannot post now because no valid target channel is selected.'
    );
  };

  const handleCancelScheduled = async (postId: number) => {
    try {
      const result = await electronAPI.posts.cancelScheduled(postId);
      setStatusMessage(result.message);
      if (result.post) {
        setSelectedPost(result.post);
        populateEditForm(result.post);
      }
      await loadPosts();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : language === 'vi'
            ? 'Không thể hủy bài viết đã lên lịch'
            : 'Failed to cancel scheduled post'
      );
    }
  };

   const handleDuplicateAsDraft = async (postId: number) => {
     try {
       const duplicated = await electronAPI.posts.duplicateAsDraft(postId);
       setStatusMessage(
         language === 'vi'
           ? `Đã nhân bản bài viết #${postId} thành nháp #${duplicated.id}.`
           : `Post #${postId} duplicated as draft #${duplicated.id}.`
       );
       await loadPosts();
       await handleViewPost(duplicated.id);
     } catch (error) {
       setStatusMessage(
         error instanceof Error
           ? error.message
           : language === 'vi'
             ? 'Không thể nhân bản bài viết thành nháp'
             : 'Failed to duplicate post as draft'
       );
     }
   };
 
   const handleRetrySimulation = async (postId: number) => {
     try {
       const result = await electronAPI.posts.retrySimulation(postId);
       setStatusMessage(result.message);
       await loadPosts();
       if (result.post) {
         await handleViewPost(result.post.id);
       }
     } catch (error) {
       setStatusMessage(
         error instanceof Error
           ? error.message
           : language === 'vi'
             ? 'Không thể thử lại bài viết mô phỏng'
             : 'Failed to retry simulation post'
       );
     }
   };
 
   const handleRefreshSelectedPost = async () => {
    if (!selectedPost) {
      return;
    }

    await handleViewPost(selectedPost.id);
    setStatusMessage(
      language === 'vi'
        ? `Đã làm mới bài viết #${selectedPost.id} từ trạng thái cục bộ.`
        : `Post #${selectedPost.id} refreshed from local status.`
    );
  };

  const handleStartEdit = () => {
    if (!selectedPost) {
      return;
    }

    if (selectedPost.status === 'published') {
      setStatusMessage(
        language === 'vi'
          ? 'Bài viết Facebook đã đăng không thể được chỉnh sửa từ xa. Hãy tạo một bản nháp cục bộ mới thay thế.'
          : 'Published Facebook posts cannot be edited remotely. Create a new local draft copy instead.'
      );
      return;
    }

    setEditMode(true);
    populateEditForm(selectedPost);
  };

  const handleSaveEdit = async () => {
    if (!selectedPost) {
      return;
    }

    try {
      setSavingPost(true);
      const pageTargets = buildEditableFacebookPageTargets(selectedPost.postTargets);

      const targetAccounts =
        pageTargets.length > 0
          ? getUniqueTargetAccountsFromPageTargets(pageTargets)
          : undefined;

      const updated = await electronAPI.posts.updateLocal(selectedPost.id, {
        title: editForm.title || undefined,
        content: editForm.content,
        hashtags: editForm.hashtags || undefined,
        status: selectedPost.status === 'scheduled' ? 'scheduled' : 'draft',
        scheduledAt: editForm.scheduledAt ? new Date(editForm.scheduledAt).toISOString() : null,
        targetAccounts,
        pageTargets,
      });

      setSelectedPost(updated);
      setEditMode(false);
      setStatusMessage(
        language === 'vi'
          ? `Đã cập nhật cục bộ bài viết #${updated.id}.`
          : `Post #${updated.id} updated locally.`
      );
      await loadPosts();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : language === 'vi'
            ? 'Không thể cập nhật bài viết cục bộ'
            : 'Failed to update local post'
      );
    } finally {
      setSavingPost(false);
    }
  };

   const persistedBulkDisabledReason = useMemo(() => {
    if (selectedPersistedPosts.length === 0) {
      return language === 'vi'
        ? 'Chưa chọn post cục bộ nào để review controlled bulk publish.'
        : 'No local posts are selected for controlled bulk publish review.';
    }

    if (selectedPersistedPosts.length > CONTROLLED_BULK_PUBLISH_BATCH_LIMIT) {
      return getBulkEligibilityReasonLabel('batch_limit_exceeded');
    }

    if (!realPublishingEnabled) {
      return persistedBulkBlockedMessage;
    }

    return null;
  }, [selectedPersistedPosts.length, realPublishingEnabled, language]);

  function togglePersistedPostSelection(postId: number) {
    setSelectedPersistedPostIds((prev) => {
      if (prev.includes(postId)) {
        return prev.filter((value) => value !== postId);
      }

      if (prev.length >= CONTROLLED_BULK_PUBLISH_BATCH_LIMIT) {
        setStatusMessage(persistedBulkSelectionLimitMessage);
        return prev;
      }

      return [...prev, postId];
    });
  }

  async function openPersistedBulkReviewModal() {
    if (selectedPersistedPosts.length === 0) {
      setStatusMessage(
        language === 'vi'
          ? 'Chưa chọn post cục bộ nào để review controlled bulk publish.'
          : 'No local posts are selected for controlled bulk publish review.'
      );
      return;
    }

    if (!realPublishingEnabled) {
      setStatusMessage(persistedBulkBlockedMessage);
      return;
    }

    const prepared = await electronAPI.bulkPublish.prepare({
      rows: persistedBulkPreparePayload,
      language,
      batchLimit: CONTROLLED_BULK_PUBLISH_BATCH_LIMIT,
    });

    setPersistedBulkPreparedRows(
      prepared.rows.map((row) => {
        const existingPost = posts.find((post) => post.id === row.existingPostId);
        return {
          clientRowId: row.clientRowId,
          existingPostId: row.existingPostId ?? 0,
          title: row.title,
          contentPreview: existingPost?.content.slice(0, 160) ?? '',
          status: existingPost?.status ?? 'unknown',
          targetPageLabel: row.targetPageLabel,
          mediaType: existingPost?.mediaType ?? 'none',
          hasImage: row.hasImage,
          createdAtLabel: existingPost?.createdAt ? new Date(existingPost.createdAt).toLocaleString() : null,
          scheduledAtLabel: existingPost?.scheduledAt ? new Date(existingPost.scheduledAt).toLocaleString() : null,
          isEligible: row.isEligible,
          reasonKey: row.reasonKey,
          reason: row.reason,
        };
      })
    );
    setPersistedBulkConfirmChecked(false);
    setPersistedBulkConfirmText('');
    setPersistedBulkConfirmationToken(`persisted-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    setShowPersistedBulkPublishModal(true);
    setPersistedBulkProgress(null);
    setStatusMessage(null);
  }

  async function handleConfirmPersistedBulkPublish() {
    if (!persistedBulkConfirmReady) {
      return;
    }

    setPersistedBulkSubmitting(true);

    try {
      const result = await electronAPI.bulkPublish.createJobs({
        rows: persistedBulkPreparePayload,
        language,
        batchLimit: CONTROLLED_BULK_PUBLISH_BATCH_LIMIT,
        confirmationText: persistedBulkConfirmText,
        confirmationChecked: persistedBulkConfirmChecked,
        confirmationToken: persistedBulkConfirmationToken ?? `persisted-fallback-${Date.now()}`,
      });

      const progressRows: PersistedBulkProgressRow[] = result.results.map((row) => ({
        rowId: row.clientRowId,
        postId: row.createdPostId ?? row.existingPostId ?? 0,
        title: row.title,
        status: row.status,
        message: row.message,
        canCancelBeforeStart: row.canCancelBeforeStart,
      }));

      setPersistedBulkProgress(buildPersistedBulkProgressSnapshot(progressRows));
      setShowPersistedBulkPublishModal(false);
      setPersistedBulkConfirmChecked(false);
      setPersistedBulkConfirmText('');
      setPersistedBulkProgressRefreshTick((value) => value + 1);

      setStatusMessage(
        result.duplicateBatchBlocked
          ? language === 'vi'
            ? 'Batch này đã được xác nhận trước đó. Không có duplicate jobs nào được tạo.'
            : 'This batch was already confirmed earlier. No duplicate jobs were created.'
          : language === 'vi'
            ? `Đã xử lý controlled bulk publish cho ${result.createdPostIds.length} post hiện có một cách an toàn.`
            : `Controlled bulk publish processed ${result.createdPostIds.length} existing posts safely.`
      );

      await loadPosts();
    } finally {
      setPersistedBulkSubmitting(false);
    }
  }

  async function handleCancelPersistedQueuedPost(postId: number) {
    const result = await electronAPI.bulkPublish.cancelQueued(postId);
    setStatusMessage(result.message);
    setPersistedBulkProgressRefreshTick((value) => value + 1);
    await loadPosts();
  }

  useEffect(() => {
    if (!persistedBulkProgress) {
      return;
    }

    const postIds = persistedBulkProgress.results
      .map((result) => result.postId)
      .filter((value): value is number => typeof value === 'number' && value > 0);

    if (postIds.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setPersistedBulkProgressRefreshTick((value) => value + 1);
    }, 2500);

    return () => window.clearInterval(timer);
  }, [persistedBulkProgress]);

  useEffect(() => {
    if (!persistedBulkProgress) {
      return;
    }

    const postIds = persistedBulkProgress.results
      .map((result) => result.postId)
      .filter((value): value is number => typeof value === 'number' && value > 0);

    if (postIds.length === 0) {
      return;
    }

    void (async () => {
      const latestPosts = await electronAPI.bulkPublish.getProgress({ postIds });
      const latestPostsById = new Map<number, PostSnapshot>();
      latestPosts.forEach((post) => latestPostsById.set(post.id, post));

      setPersistedBulkProgress((prev) => {
        if (!prev) {
          return prev;
        }

        return buildPersistedBulkProgressSnapshot(prev.results, latestPostsById);
      });
    })();
  }, [persistedBulkProgressRefreshTick, persistedBulkProgress, electronAPI.bulkPublish]);

  const selectedPrimaryTarget = selectedPost ? getPrimaryTarget(selectedPost) : null;
   const selectedPlatformPostId = selectedPrimaryTarget
     ? (selectedPrimaryTarget as PostTargetSnapshot & { platformPostId?: string | null }).platformPostId
     : null;
   const selectedIsSimulation = selectedPost ? isSimulationPost(selectedPost) : false;
   const selectedIsRealFacebook = selectedPost ? isRealFacebookPost(selectedPost) : false;

  return (
    <div className="so9-page">
      <section className="so9-hero-card">
        <p className="so9-hero-kicker">{language === 'vi' ? 'Quản lý bài đăng · trạng thái, chi tiết, hành động an toàn' : 'Posts · status, detail, safe actions'}</p>
        <div className="so9-responsive-stack mt-3">
          <div className="min-w-0">
            <h1 className="so9-hero-title">{t('posts', language)}</h1>
            <p className="so9-hero-description">
              {language === 'vi'
                ? 'Quét nhanh trạng thái, kênh đích, lịch sử thử đăng, bộ lọc và các bước an toàn cho từng bài viết trong một nơi dễ theo dõi.'
                : 'Quickly scan status, target channels, publish attempts, filters, and safe next steps for every post in one place.'}
            </p>
            <div className="so9-hero-actions">
              <div className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                {language === 'vi' ? `Tổng bài viết: ${posts.length}` : `Total posts: ${posts.length}`}
              </div>
              <div className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                {language === 'vi' ? `Đang hiển thị: ${filteredPosts.length}` : `Showing: ${filteredPosts.length}`}
              </div>
              <div className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                {language === 'vi' ? `Đăng thật: ${realPublishingEnabled ? 'Bật' : 'Tắt'}` : `Real publish: ${realPublishingEnabled ? 'On' : 'Off'}`}
              </div>
            </div>
          </div>
          <div className="so9-page-actions">
            <Button
              variant="outline"
              className="rounded-full border-white/40 bg-white/10 text-white hover:bg-white/20"
              onClick={() => navigate('/diagnostics')}
              data-testid="posts-overview-diagnostics-link"
            >
              <ArrowRightCircle className="mr-2 h-4 w-4" />
              {language === 'vi' ? 'Mở Chẩn đoán' : 'Open Diagnostics'}
            </Button>
            <Button className="rounded-full bg-white text-[#12338f] hover:bg-[#f5f8ff]" onClick={() => navigate('/create-post')}>
              <Plus className="mr-2 h-4 w-4" />
              {t('createPost', language)}
            </Button>
          </div>
        </div>
      </section>

      {statusMessage && (
        <div className="so9-banner so9-banner-info">
          <div>
            <p className="font-semibold">{language === 'vi' ? 'Cập nhật thao tác' : 'Action update'}</p>
            <p className="mt-1 text-sm">{statusMessage}</p>
          </div>
        </div>
      )}

      {createdPostIdFilter.length > 0 && (
        <div className="so9-banner so9-banner-success">
          <div>
            <p className="font-semibold">
              {language === 'vi' ? 'Đang lọc các bài viết mới tạo' : 'Filtering to newly created posts'}
            </p>
            <p className="mt-1 text-sm">
              {language === 'vi' ? 'Lọc theo mã bài viết:' : 'Filtered to post ids:'} {createdPostIdFilter.join(', ')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full bg-white/80"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('createdPostIds');
              setSearchParams(next, { replace: true });
            }}
          >
            {language === 'vi' ? 'Xóa bộ lọc' : 'Clear filter'}
          </Button>
        </div>
      )}

      {detailLoading ? (
        <div className="so9-empty-state py-8">
          <p className="so9-state-title mt-0 text-sm">
            {language === 'vi' ? 'Đang tải chi tiết bài viết…' : 'Loading post details…'}
          </p>
          <p className="so9-state-description mt-1 text-xs">
            {language === 'vi'
              ? 'Đang đồng bộ timeline, media preview và trạng thái local hiện tại.'
              : 'Syncing timeline, media preview, and the latest local state.'}
          </p>
        </div>
      ) : null}

      {detailError && !detailLoading && !selectedPost ? (
        <div className="so9-banner so9-banner-danger">
          <div>
            <p className="font-semibold">{language === 'vi' ? 'Không mở được chi tiết bài viết' : 'Unable to open post detail'}</p>
            <p className="mt-1 text-sm">{detailError}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full bg-white/80"
            onClick={() => {
              setDetailError(null);
              setOpenedFromDiagnostics(false);
            }}
          >
            {language === 'vi' ? 'Đóng' : 'Close'}
          </Button>
        </div>
      ) : null}

      {selectedPost && !detailLoading ? (
        <Card className="so9-flat-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[#e8eef8]">
            <div>
              <CardTitle>{language === 'vi' ? 'Chi tiết bài viết' : 'Post Detail'}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {language === 'vi'
                  ? 'Tập trung vào trạng thái, kênh đích, media và timeline an toàn của bài viết. Không thực hiện sửa/xóa từ xa trên Facebook.'
                  : 'Focus on the post status, target channel, media, and safe timeline. No remote Facebook edit/delete is performed.'}
              </p>
              {openedFromDiagnostics ? (
                <p className="text-xs text-muted-foreground">
                  {language === 'vi'
                    ? 'Được mở từ công việc gần đây trong Chẩn đoán.'
                    : 'Opened from Diagnostics recent jobs.'}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
               {selectedPost.status === 'scheduled' || selectedPost.status === 'queued' ? (
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => void handleCancelScheduled(selectedPost.id)}
                 >
                   <XCircle className="mr-2 h-4 w-4" />
                    {language === 'vi' ? 'Hủy công việc cục bộ' : 'Cancel Local Job'}
                 </Button>
               ) : null}
               {selectedIsSimulation &&
               (selectedPost.status === 'failed' ||
                 selectedPost.status === 'blocked' ||
                 selectedPost.status === 'partially_failed') ? (
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => void handleRetrySimulation(selectedPost.id)}
                 >
                   <RefreshCw className="mr-2 h-4 w-4" />
                    {language === 'vi' ? 'Thử lại mô phỏng' : 'Retry Simulation'}
                 </Button>
               ) : null}
               <Button variant="outline" size="sm" onClick={() => void handleDuplicateAsDraft(selectedPost.id)}>
                 <Copy className="mr-2 h-4 w-4" />
                  {language === 'vi' ? 'Nhân bản thành nháp' : 'Duplicate as Draft'}
               </Button>
              <Button variant="outline" size="sm" onClick={handleStartEdit}>
                <Eye className="mr-2 h-4 w-4" />
                {editMode ? (language === 'vi' ? 'Đang chỉnh sửa' : 'Editing') : (language === 'vi' ? 'Sửa cục bộ' : 'Edit Local')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleRefreshSelectedPost()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {language === 'vi' ? 'Làm mới trạng thái cục bộ' : 'Refresh Local Status'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/diagnostics')}>
                <ArrowRightCircle className="mr-2 h-4 w-4" />
                {language === 'vi' ? 'Mở chẩn đoán' : 'Open Diagnostics'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPost(null);
                  setOpenedFromDiagnostics(false);
                }}
              >
                {language === 'vi' ? 'Đóng' : 'Close'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
                <p className="so9-muted-label">{language === 'vi' ? 'Trạng thái' : 'Status'}</p>
                <div className="mt-2">
                  <Badge
                    variant={
                      statusColors[selectedPost.status as keyof typeof statusColors] ?? 'outline'
                    }
                  >
                    {statusLabel(selectedPost.status, language)}
                  </Badge>
                </div>
              </div>
              <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
                <p className="so9-muted-label">{language === 'vi' ? 'Đăng lúc' : 'Published At'}</p>
                <p className="mt-2 text-sm font-medium text-[#17233b]">
                  {selectedPost.publishedAt
                    ? new Date(selectedPost.publishedAt).toLocaleString()
                    : language === 'vi' ? 'Chưa đăng' : 'Not published'}
                </p>
              </div>
              <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
                <p className="so9-muted-label">{language === 'vi' ? 'Media type' : 'Media type'}</p>
                <p className="mt-2 text-sm font-medium text-[#17233b]">{getSafeMediaLabel(selectedPost, language)}</p>
              </div>
              <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
                <p className="so9-muted-label">{language === 'vi' ? 'Hành động an toàn' : 'Safe next step'}</p>
                <p className="mt-2 text-sm font-medium text-[#17233b]">
                  {selectedPost.status === 'needs_verification'
                    ? language === 'vi'
                      ? 'Kiểm tra thủ công'
                      : 'Manual verification'
                    : language === 'vi'
                      ? 'Review cục bộ'
                      : 'Local review'}
                </p>
              </div>
            </div>

            <div className="rounded-[20px] border border-[#e6edf8] bg-[#fbfdff] p-4 space-y-4">
              <div>
                <p className="text-sm font-medium">
                  {language === 'vi' ? 'Tóm tắt kênh đang dùng' : 'Current channel summary'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {language === 'vi'
                    ? 'Giúp bạn kiểm tra nhanh bài viết này đang gắn với Trang nào, tài khoản nguồn nào và external id an toàn còn lại.'
                    : 'Helps you quickly review which Page this post is tied to, which source account it uses, and the remaining safe external-id suffix.'}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[18px] border border-[#e6edf8] bg-white p-3">
                  <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Kênh / Trang đích' : 'Target channel / Page'}</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedPrimaryTarget?.pageName ?? selectedPrimaryTarget?.accountName ?? (language === 'vi' ? 'Không rõ' : 'Unknown')}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[#e6edf8] bg-white p-3">
                  <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Tài khoản nguồn' : 'Source Account'}</p>
                  <p className="mt-1 text-sm">
                    {selectedPrimaryTarget?.sourceAccountName ?? (language === 'vi' ? 'Không rõ' : 'Unknown')}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[#e6edf8] bg-white p-3">
                  <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Mã ngoài an toàn' : 'Safe external ID'}</p>
                  <p className="mt-1 text-sm">
                    {selectedPlatformPostId
                      ? maskIdentifier(selectedPlatformPostId, language)
                      : language === 'vi'
                        ? 'Chưa có'
                        : 'Not available'}
                  </p>
                </div>
              </div>
            </div>

            {getPostMediaPreviewSrc(selectedPost) ? (
              <div className="space-y-3 rounded-[20px] border border-[#e6edf8] bg-[#fbfdff] p-4">
                <div>
                  <p className="text-sm font-medium">{language === 'vi' ? 'Xem trước media' : 'Media Preview'}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'vi'
                      ? 'Xem trước media theo kích thước cố định để tránh kéo giãn bố cục trang.'
                      : 'Fixed-size media preview to avoid stretching the page layout.'}
                  </p>
                </div>
                <div className="flex h-72 items-center justify-center overflow-hidden rounded-[20px] border bg-muted/20 p-3">
                  <img
                    src={getPostMediaPreviewSrc(selectedPost) ?? ''}
                    alt={language === 'vi' ? 'Xem trước media bài viết' : 'Post media preview'}
                    className="h-full w-full object-contain"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedPost.mediaLocalPath
                    ? `${language === 'vi' ? 'Tệp cục bộ' : 'Local file'}: ${selectedPost.mediaLocalPath.split(/[/\\]/).pop() ?? selectedPost.mediaLocalPath}`
                    : selectedPost.mediaUrl
                      ? `${language === 'vi' ? 'Nguồn media' : 'Media source'}: ${language === 'vi' ? 'Đã gắn URL media' : 'Attached media URL'}`
                      : language === 'vi'
                        ? 'Không có nguồn media.'
                        : 'No media source.'}
                </p>
              </div>
            ) : null}

            {selectedPost.attemptTimeline && selectedPost.attemptTimeline.length > 0 ? (
              <div className="space-y-3 rounded-[20px] border border-[#e6edf8] bg-[#fbfdff] p-4">
                <div>
                  <p className="text-sm font-medium">{language === 'vi' ? 'Dòng thời gian lần thử đăng' : 'Publish Attempt Timeline'}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'vi'
                      ? 'Chỉ hiển thị lịch sử thử đăng cục bộ an toàn. Mô phỏng không bao giờ được tính là thành công thật trên Facebook.'
                      : 'Safe local attempt history only. Simulation never counts as real Facebook success.'}
                  </p>
                </div>
                <div className="space-y-3">
                  {selectedPost.attemptTimeline.map((attempt, index) => (
                    <div key={`${attempt.attemptNumber}-${attempt.startedAt ?? index}`} className="rounded-[18px] border border-[#e6edf8] bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {language === 'vi' ? 'Lần thử' : 'Attempt'} {attempt.attemptNumber === 0 ? (language === 'vi' ? 'Trạng thái công việc' : 'Job State') : `#${attempt.attemptNumber}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {attempt.platform} · {attempt.mode} · {attempt.targetPageName ?? (language === 'vi' ? 'Đích không rõ' : 'Unknown target')}
                          </p>
                        </div>
                        <Badge variant={statusColors[attempt.status as keyof typeof statusColors] ?? 'outline'}>
                          {statusLabel(attempt.status, language)}
                        </Badge>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">{language === 'vi' ? 'Nguồn:' : 'Source:'}</span>{' '}
                          {attempt.sourceAccountName ?? (language === 'vi' ? 'Không rõ' : 'Unknown')}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{language === 'vi' ? 'Bắt đầu:' : 'Started:'}</span>{' '}
                          {attempt.startedAt ? new Date(attempt.startedAt).toLocaleString() : language === 'vi' ? 'Chưa ghi nhận' : 'Not recorded'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{language === 'vi' ? 'Kết thúc:' : 'Finished:'}</span>{' '}
                          {attempt.finishedAt ? new Date(attempt.finishedAt).toLocaleString() : language === 'vi' ? 'Chưa ghi nhận' : 'Not recorded'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{language === 'vi' ? 'Thời lượng:' : 'Duration:'}</span>{' '}
                          {typeof attempt.durationMs === 'number' ? `${attempt.durationMs} ms` : language === 'vi' ? 'Chưa ghi nhận' : 'Not recorded'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{language === 'vi' ? 'Mã ngoài:' : 'External ID:'}</span>{' '}
                          {attempt.safeExternalIdSuffix ? `••${attempt.safeExternalIdSuffix}` : language === 'vi' ? 'Chưa có' : 'Not available'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{language === 'vi' ? 'Lỗi:' : 'Error:'}</span>{' '}
                          {attempt.errorMessage ?? attempt.errorCode ?? (language === 'vi' ? 'Không có' : 'None')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {editMode ? (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="space-y-2">
                  <Label>{language === 'vi' ? 'Tiêu đề' : 'Title'}</Label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('content', language)}</Label>
                  <Textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, content: e.target.value }))}
                    className="min-h-[180px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('hashtags', language)}</Label>
                  <Input
                    value={editForm.hashtags}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, hashtags: e.target.value }))
                    }
                  />
                </div>
                {selectedPost.status === 'scheduled' ? (
                  <div className="space-y-2">
                      <Label>{language === 'vi' ? 'Lên lịch lúc' : 'Scheduled At'}</Label>
                    <Input
                      type="datetime-local"
                      value={editForm.scheduledAt}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, scheduledAt: e.target.value }))
                      }
                    />
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button onClick={() => void handleSaveEdit()} disabled={savingPost}>
                    <Save className="mr-2 h-4 w-4" />
                    {language === 'vi' ? 'Lưu thay đổi cục bộ' : 'Save Local Changes'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditMode(false)}
                    disabled={savingPost}
                  >
                    {language === 'vi' ? 'Hủy' : 'Cancel'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-[20px] border border-[#e6edf8] bg-[#fbfdff] p-4">
                <div>
                  <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Tiêu đề' : 'Title'}</p>
                  <p className="text-sm font-medium">{selectedPost.title || (language === 'vi' ? 'Bài viết chưa có tiêu đề' : 'Untitled Post')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('content', language)}</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedPost.content}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('schedule', language)}</p>
                  <p className="text-sm">
                    {selectedPost.scheduledAt
                      ? new Date(selectedPost.scheduledAt).toLocaleString()
                      : language === 'vi' ? 'Không có lịch' : 'No schedule'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Lỗi' : 'Error'}</p>
                  <p className="text-sm">{selectedPost.errorMessage ?? (language === 'vi' ? 'Không có' : 'None')}</p>
                </div>
                <div className="space-y-2 rounded-[18px] border border-[#e6edf8] bg-white p-4">
                  <p className="text-sm font-medium">{language === 'vi' ? 'Media metadata an toàn' : 'Safe media metadata'}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'vi'
                      ? 'Chỉ hiển thị metadata cục bộ hữu ích để review. Không hiển thị token, signed URL hay dữ liệu nhạy cảm khác.'
                      : 'Shows only useful local metadata for review. No tokens, signed URLs, or other sensitive values are displayed.'}
                  </p>
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <p>{language === 'vi' ? 'Media type' : 'Media type'}: {getSafeMediaLabel(selectedPost, language)}</p>
                    <p>{language === 'vi' ? 'Tên tệp' : 'File name'}: {selectedPost.mediaFileName ?? '—'}</p>
                    <p>{language === 'vi' ? 'Kích thước' : 'File size'}: {formatMediaFileSize(selectedPost.mediaFileSize, language)}</p>
                    <p>{language === 'vi' ? 'MIME type' : 'MIME type'}: {selectedPost.mediaMimeType ?? '—'}</p>
                    <p>{language === 'vi' ? 'Phần mở rộng' : 'Extension'}: {selectedPost.mediaExtension ?? '—'}</p>
                    <p>{language === 'vi' ? 'Thời lượng' : 'Duration'}: {formatMediaDuration(selectedPost.mediaDurationMs, language)}</p>
                  </div>
                  {selectedPost.mediaType === 'video' ? (
                    <p className="text-sm text-amber-600">
                      {language === 'vi'
                        ? 'Đăng video Facebook — Facebook có thể hiển thị video mới dưới dạng Reels. App không khẳng định native Reels API support riêng.'
                        : 'Facebook video publish — Facebook may show new videos as Reels. This app does not claim native Reels API support.'}
                    </p>
                  ) : null}
                </div>
                  <div className="space-y-2 rounded-[18px] border border-[#e6edf8] bg-white p-4">
                    <p className="text-sm font-medium">{language === 'vi' ? 'Hành động khôi phục an toàn' : 'Safe recovery actions'}</p>
                    <p className="text-sm text-muted-foreground">
                      {language === 'vi'
                        ? 'Có thể nhân bản thành nháp, hủy công việc cục bộ đang chờ/đã lên lịch, làm mới trạng thái cục bộ hoặc mở Chẩn đoán. Thử lại Facebook thật vẫn tắt theo mặc định trừ khi được bật và xác nhận thủ công sau này.'
                        : 'Duplicate as draft, cancel queued/scheduled local jobs, refresh local status, or open Diagnostics. Real Facebook retry remains disabled unless it is explicitly enabled and manually confirmed later.'}
                    </p>
                  </div>
                 {selectedIsSimulation &&
                 (selectedPost.status === 'failed' ||
                   selectedPost.status === 'blocked' ||
                   selectedPost.status === 'partially_failed') ? (
                   <div>
                      <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Thử lại mô phỏng' : 'Simulation Retry'}</p>
                      <p className="text-sm">
                        {language === 'vi'
                          ? 'Bản ghi này chỉ dùng đích mô phỏng nên có thể thử lại cục bộ.'
                          : 'This record uses simulation targets only, so a local-only retry is available.'}
                      </p>
                   </div>
                 ) : null}
                 {selectedIsRealFacebook &&
                 (selectedPost.status === 'failed' ||
                   selectedPost.status === 'blocked' ||
                   selectedPost.status === 'partially_failed') ? (
                   <div>
                      <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Thử lại Facebook thật' : 'Real Facebook Retry'}</p>
                      <p className="text-sm">
                        {language === 'vi'
                          ? 'Thử lại Facebook thật cần luồng đăng có kiểm soát riêng và đang tắt theo mặc định.'
                          : 'Real Facebook retry requires explicit controlled publish flow and is disabled by default.'}
                      </p>
                   </div>
                 ) : null}
                  {selectedPost.status === 'needs_verification' ? (
                    <div className="space-y-2 rounded-[18px] border border-amber-300 bg-amber-50/60 p-4">
                      <p className="text-sm font-medium text-amber-800">{language === 'vi' ? 'Trạng thái xác minh' : 'Verification Status'}</p>
                      <p className="text-sm text-amber-700">
                        {language === 'vi'
                          ? 'Facebook đã nhận video, nhưng app chưa xác minh được trạng thái đăng cuối cùng. Hãy mở Facebook để kiểm tra thủ công hoặc xem thêm trong Chẩn đoán trước khi thực hiện hành động khác.'
                          : 'Facebook accepted the video upload, but the app could not confirm the final published state. Open Facebook to verify manually or review Diagnostics before taking further action.'}
                      </p>
                      <p className="text-xs text-amber-700">
                        {language === 'vi'
                          ? 'Hành động đánh dấu đã kiểm tra cục bộ chưa được mở ở bước này để tránh fake success.'
                          : 'A local mark-as-verified action is intentionally not exposed at this step to avoid fake success.'}
                      </p>
                   </div>
                 ) : null}
                {openedFromDiagnostics ? (
                  <div>
                      <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Nguồn chẩn đoán' : 'Diagnostics Source'}</p>
                      <p className="text-sm">
                        {language === 'vi'
                          ? 'Chế độ xem chi tiết này được mở từ bản ghi công việc trong Chẩn đoán để kiểm tra cục bộ.'
                          : 'This detail view was opened from a diagnostics job record for local inspection only.'}
                      </p>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

        <Card className="so9-flat-card">
          <CardHeader className="border-b border-[#e8eef8]">
            <CardTitle>
              {language === 'vi' ? 'Review controlled bulk publish cho post đã tạo' : 'Controlled bulk publish review for existing posts'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="so9-metric-card border border-[#e6edf8] bg-white p-3 text-sm shadow-none">
                <p className="so9-metric-label">{language === 'vi' ? 'Đã chọn' : 'Selected'}</p>
                <p className="mt-2 text-2xl font-bold text-[#17233b]">
                  {selectedPersistedPosts.length}/{CONTROLLED_BULK_PUBLISH_BATCH_LIMIT}
                </p>
              </div>
              <div className="so9-metric-card border border-[#e6edf8] bg-white p-3 text-sm shadow-none">
                <p className="so9-metric-label">{language === 'vi' ? 'Eligible' : 'Eligible'}</p>
                <p className="mt-2 text-2xl font-bold text-[#17233b]">{persistedBulkEligibleRows.length}</p>
              </div>
              <div className="so9-metric-card border border-[#e6edf8] bg-white p-3 text-sm shadow-none">
                <p className="so9-metric-label">{language === 'vi' ? 'Blocked' : 'Blocked'}</p>
                <p className="mt-2 text-2xl font-bold text-[#17233b]">{persistedBulkBlockedRows.length}</p>
              </div>
              <div className="so9-metric-card border border-[#e6edf8] bg-white p-3 text-sm shadow-none">
                <p className="so9-metric-label">{language === 'vi' ? 'Text-only / ảnh' : 'Text-only / images'}</p>
                <p className="mt-2 text-2xl font-bold text-[#17233b]">
                  {persistedBulkTextOnlyCount} / {persistedBulkImageCount}
                </p>
              </div>
            </div>

          {selectedPersistedPosts.length > 0 ? (
            <div className="space-y-3 rounded-[24px] border bg-[#fbfdff] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {language === 'vi' ? 'Xem trước post đã chọn' : 'Selected post preview'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'vi'
                      ? 'Hiển thị id, đoạn nội dung, trạng thái, kênh đích, media type và thời gian khả dụng trước khi review.'
                      : 'Shows id, content snippet, status, target channel, media type, and available time fields before review.'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setSelectedPersistedPostIds([]);
                    setPersistedBulkPreparedRows([]);
                    setPersistedBulkProgress(null);
                    setShowPersistedBulkPublishModal(false);
                  }}
                >
                  {language === 'vi' ? 'Xóa chọn' : 'Clear selection'}
                </Button>
              </div>

              <div className="space-y-2">
                {(persistedBulkPreparedRows.length > 0 ? persistedBulkPreparedRows : selectedPersistedPosts.map((post) => {
                  const primaryTarget = getPrimaryTarget(post);
                  return {
                    clientRowId: `persisted-post-preview-${post.id}`,
                    existingPostId: post.id,
                    title: post.title || (language === 'vi' ? 'Bài viết chưa có tiêu đề' : 'Untitled Post'),
                    contentPreview: post.content.slice(0, 160),
                    status: post.status,
                    targetPageLabel: primaryTarget?.pageName ?? primaryTarget?.accountName ?? (language === 'vi' ? 'Đích không rõ' : 'Unknown target'),
                    mediaType: post.mediaType ?? 'none',
                    hasImage: post.mediaType === 'photo',
                    createdAtLabel: new Date(post.createdAt).toLocaleString(),
                    scheduledAtLabel: post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : null,
                    isEligible: false,
                    reasonKey: null,
                    reason: null,
                  };
                })).map((row) => (
                  <div
                    key={row.clientRowId}
                    className={`rounded-[20px] border p-3 text-sm ${
                      persistedBulkPreparedRows.length === 0
                        ? 'border-border'
                        : row.isEligible
                          ? 'border-emerald-300 bg-emerald-50/60'
                          : 'border-destructive/30 bg-destructive/5'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="font-medium">
                          #{row.existingPostId} · {row.title}
                        </p>
                        <p className="line-clamp-3 text-muted-foreground">{row.contentPreview || (language === 'vi' ? 'Không có nội dung.' : 'No content.')}</p>
                        <div className="grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                          <p>{language === 'vi' ? 'Trạng thái' : 'Status'}: {statusLabel(row.status, language)}</p>
                          <p>{language === 'vi' ? 'Kênh đích' : 'Target channel'}: {row.targetPageLabel}</p>
                          <p>{language === 'vi' ? 'Media type' : 'Media type'}: {row.mediaType ?? 'none'}</p>
                          <p>{language === 'vi' ? 'Tạo lúc' : 'Created'}: {row.createdAtLabel ?? '—'}</p>
                          <p>{language === 'vi' ? 'Lên lịch' : 'Scheduled'}: {row.scheduledAtLabel ?? '—'}</p>
                          {row.mediaType === 'video' ? (
                            <p className="md:col-span-2 text-amber-600">
                              {language === 'vi'
                                ? 'Bulk publish video chưa được hỗ trợ. Với đăng đơn, Facebook có thể hiển thị video mới dưới dạng Reels nhưng app không khẳng định native Reels API support riêng.'
                                : 'Bulk video publish is not supported. For single-video publish, Facebook may show new videos as Reels, but this app does not claim native Reels API support.'}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {persistedBulkPreparedRows.length > 0 ? (
                        <Badge variant={row.isEligible ? 'default' : 'destructive'}>
                          {row.isEligible
                            ? language === 'vi'
                              ? 'Đủ điều kiện'
                              : 'Eligible'
                            : language === 'vi'
                              ? 'Bị chặn'
                              : 'Blocked'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {language === 'vi' ? 'Đã chọn' : 'Selected'}
                        </Badge>
                      )}
                    </div>
                    {!row.isEligible && row.reason ? (
                      <p className="mt-2 text-destructive">{row.reason}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="so9-empty-state rounded-[24px] px-4 py-8 text-sm text-muted-foreground">
              {language === 'vi'
                ? 'Chọn các post cục bộ bên dưới rồi mở review.'
                : 'Select local posts below and open the review.'}
            </div>
          )}

          {persistedBulkProgress ? (
            <div className="rounded-[24px] border bg-[#fbfdff] p-4" data-testid="posts-persisted-bulk-progress-panel">
              <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
                <div className="rounded-[20px] border bg-white p-3 text-sm"><p className="font-medium">{language === 'vi' ? 'Đã chọn' : 'Selected'}</p><p className="text-muted-foreground">{persistedBulkProgress.selectedCount}</p></div>
                <div className="rounded-[20px] border bg-white p-3 text-sm"><p className="font-medium">{language === 'vi' ? 'Eligible' : 'Eligible'}</p><p className="text-muted-foreground">{persistedBulkProgress.eligibleCount}</p></div>
                <div className="rounded-[20px] border bg-white p-3 text-sm"><p className="font-medium">{language === 'vi' ? 'Queued' : 'Queued'}</p><p className="text-muted-foreground">{persistedBulkProgress.queuedCount}</p></div>
                <div className="rounded-[20px] border bg-white p-3 text-sm"><p className="font-medium">{language === 'vi' ? 'Posting' : 'Posting'}</p><p className="text-muted-foreground">{persistedBulkProgress.postingCount}</p></div>
                <div className="rounded-[20px] border bg-white p-3 text-sm"><p className="font-medium">{language === 'vi' ? 'Published' : 'Published'}</p><p className="text-muted-foreground">{persistedBulkProgress.publishedCount}</p></div>
                <div className="rounded-[20px] border bg-white p-3 text-sm"><p className="font-medium">{language === 'vi' ? 'Failed' : 'Failed'}</p><p className="text-muted-foreground">{persistedBulkProgress.failedCount}</p></div>
                <div className="rounded-[20px] border bg-white p-3 text-sm"><p className="font-medium">{language === 'vi' ? 'Blocked' : 'Blocked'}</p><p className="text-muted-foreground">{persistedBulkProgress.blockedCount}</p></div>
                <div className="rounded-[20px] border bg-white p-3 text-sm"><p className="font-medium">{language === 'vi' ? 'Cancelled' : 'Cancelled'}</p><p className="text-muted-foreground">{persistedBulkProgress.cancelledCount}</p></div>
              </div>

              <div className="space-y-2">
                {persistedBulkProgress.results.map((result) => (
                  <div key={`persisted-progress-${result.rowId}`} className="rounded-[20px] border bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
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
                        {result.canCancelBeforeStart ? (
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => void handleCancelPersistedQueuedPost(result.postId)}
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
                  disabled={persistedBulkProgress.results.length === 0}
                  onClick={() =>
                    navigate(
                      `/posts?createdPostIds=${persistedBulkProgress.results
                        .map((result) => result.postId)
                        .filter((value) => value > 0)
                        .join(',')}`
                    )
                  }
                >
                  {language === 'vi' ? 'Xem trong Bài viết' : 'View in Posts'}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {language === 'vi'
                    ? 'Chỉ các job đã queue nhưng chưa bắt đầu mới có thể bị hủy. App không remote delete bài Facebook đã đăng.'
                    : 'Only queued jobs that have not started can be cancelled. The app does not remotely delete published Facebook posts.'}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              type="button"
              disabled={selectedPersistedPosts.length === 0}
              onClick={() => {
                setSelectedPersistedPostIds([]);
                setPersistedBulkPreparedRows([]);
                setPersistedBulkProgress(null);
                setShowPersistedBulkPublishModal(false);
              }}
            >
              {language === 'vi' ? 'Xóa chọn' : 'Clear selection'}
            </Button>
            <Button
              variant="destructive"
              type="button"
              data-testid="posts-persisted-open-bulk-review"
              disabled={selectedPersistedPosts.length === 0 || selectedPersistedPosts.length > CONTROLLED_BULK_PUBLISH_BATCH_LIMIT}
              onClick={() => void openPersistedBulkReviewModal()}
            >
              <Send className="mr-2 h-4 w-4" />
              {language === 'vi' ? 'Review controlled bulk publish' : 'Review controlled bulk publish'}
            </Button>
            {selectedPersistedPosts.length > CONTROLLED_BULK_PUBLISH_BATCH_LIMIT ? (
              <p className="text-sm text-destructive">{persistedBulkSelectionLimitMessage}</p>
            ) : persistedBulkDisabledReason ? (
              <p className="text-sm text-muted-foreground" data-testid="posts-persisted-bulk-disabled-message">{persistedBulkDisabledReason}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {language === 'vi'
                  ? 'Không có queue creation nào diễn ra trước khi xác nhận thủ công trong modal.'
                  : 'No queue creation occurs before manual confirmation in the modal.'}
              </p>
            )}
          </div>

          {showPersistedBulkPublishModal ? (
            <div
              className="so9-modal-card max-w-5xl border border-white/70 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
              data-testid="posts-persisted-bulk-modal"
            >
              <div className="so9-modal-header mb-4 flex items-start justify-between gap-3 rounded-[20px] border border-[#e8eef8] bg-white/70 px-4 py-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {language === 'vi'
                      ? 'Xác nhận controlled bulk publish cho post đã tạo'
                      : 'Controlled bulk publish confirmation for existing posts'}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {language === 'vi'
                      ? 'Không có job nào được tạo trước khi hoàn tất xác nhận bên dưới.'
                      : 'No jobs are created until the confirmation below is completed.'}
                  </p>
                </div>
                <Button variant="ghost" size="icon" type="button" onClick={() => setShowPersistedBulkPublishModal(false)} disabled={persistedBulkSubmitting}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[20px] border bg-white p-3 text-sm"><p className="font-medium">{language === 'vi' ? 'Tổng số post đã chọn' : 'Total selected posts'}</p><p className="text-muted-foreground">{persistedBulkPreparedRows.length}</p></div>
                <div className="rounded-[20px] border bg-white p-3 text-sm"><p className="font-medium">{language === 'vi' ? 'Eligible' : 'Eligible'}</p><p className="text-muted-foreground">{persistedBulkEligibleRows.length}</p></div>
                <div className="rounded-[20px] border bg-white p-3 text-sm"><p className="font-medium">{language === 'vi' ? 'Blocked' : 'Blocked'}</p><p className="text-muted-foreground">{persistedBulkBlockedRows.length}</p></div>
                <div className="rounded-[20px] border bg-white p-3 text-sm"><p className="font-medium">{language === 'vi' ? 'Text-only / ảnh' : 'Text-only / images'}</p><p className="text-muted-foreground">{persistedBulkTextOnlyCount} / {persistedBulkImageCount}</p></div>
              </div>

              <div className="mt-3 rounded-[20px] border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <p className="font-medium text-destructive">
                  {language === 'vi'
                    ? 'Cảnh báo: các bài đăng thật sẽ được publish lên Facebook nếu xác nhận trong khi real publish đang bật.'
                    : 'Warning: real Facebook posts will be published if you confirm while real publish is enabled.'}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>{language === 'vi' ? 'Ứng dụng này không thực hiện remote undo/delete cho bài đã publish.' : 'This app does not perform remote undo/delete for published posts.'}</li>
                  <li>{language === 'vi' ? 'Xóa cục bộ không xóa bài viết Facebook.' : 'Local delete does not delete Facebook posts.'}</li>
                </ul>
              </div>

              <div className="mt-3 rounded-[20px] border bg-white p-4 text-sm">
                <p className="font-medium">{language === 'vi' ? 'Phân bố theo kênh' : 'Channel distribution'}</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {persistedBulkPageDistribution.map(([pageLabel, count]) => (
                    <li key={pageLabel}>
                      {pageLabel}: {count}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 space-y-4">
                <label className="flex items-start gap-3 rounded-[20px] border bg-white p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    data-testid="posts-persisted-bulk-confirm-checkbox"
                    checked={persistedBulkConfirmChecked}
                    onChange={(e) => setPersistedBulkConfirmChecked(e.target.checked)}
                    disabled={persistedBulkSubmitting}
                  />
                  <span>
                    {language === 'vi'
                      ? 'Tôi hiểu rằng thao tác này sẽ publish các bài đăng thật lên Facebook.'
                      : 'I understand this will publish real posts to Facebook.'}
                  </span>
                </label>

                <div className="space-y-2">
                  <Label htmlFor="persisted-bulk-confirm-publish">PUBLISH</Label>
                  <Input
                    id="persisted-bulk-confirm-publish"
                    data-testid="posts-persisted-bulk-confirm-input"
                    value={persistedBulkConfirmText}
                    onChange={(e) => setPersistedBulkConfirmText(e.target.value)}
                    placeholder={language === 'vi' ? 'Gõ PUBLISH để xác nhận' : 'Type PUBLISH to confirm'}
                    disabled={persistedBulkSubmitting}
                  />
                </div>

                <div className="so9-modal-footer mt-2 border-0 px-0 pb-0 pt-0">
                  <Button variant="outline" type="button" onClick={() => setShowPersistedBulkPublishModal(false)} disabled={persistedBulkSubmitting}>
                    {language === 'vi' ? 'Hủy' : 'Cancel'}
                  </Button>
                  <Button
                    variant="destructive"
                    type="button"
                    data-testid="posts-persisted-bulk-confirm-button"
                    onClick={() => void handleConfirmPersistedBulkPublish()}
                    disabled={!persistedBulkConfirmReady || persistedBulkSubmitting}
                  >
                    {persistedBulkSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
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

      <Card className="so9-flat-card">
          <CardHeader className="border-b border-[#e8eef8]">
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="so9-state-inline">
                  <p className="so9-muted-label">{language === 'vi' ? 'Tổng bài đang thấy' : 'Visible posts'}</p>
                  <p className="mt-2 text-sm font-semibold text-[#17233b]">{filteredPosts.length}</p>
                </div>
                <div className="so9-state-inline">
                  <p className="so9-muted-label">{language === 'vi' ? 'Đã chọn bulk review' : 'Selected for bulk review'}</p>
                  <p className="mt-2 text-sm font-semibold text-[#17233b]">{selectedPersistedPostIds.length}</p>
                </div>
                <div className="so9-state-inline">
                  <p className="so9-muted-label">{language === 'vi' ? 'Đăng thật Facebook' : 'Real Facebook publish'}</p>
                  <p className="mt-2 text-sm font-semibold text-[#17233b]">
                    {realPublishingEnabled
                      ? language === 'vi'
                        ? 'Đang bật'
                        : 'Enabled'
                      : language === 'vi'
                        ? 'Đang tắt'
                        : 'Disabled'}
                  </p>
                </div>
                <div className="so9-state-inline">
                  <p className="so9-muted-label">{language === 'vi' ? 'Bộ lọc kênh/media' : 'Channel/media filters'}</p>
                  <p className="mt-2 text-sm font-semibold text-[#17233b]">
                    {language === 'vi' ? 'Đang hoạt động' : 'Active'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {language === 'vi'
                  ? 'Bộ lọc kênh/media và Bộ lọc kênh / nền tảng giúp bạn rà soát nhanh trạng thái, media và kênh đích.'
                  : 'Channel/media filters and Channel / platform filter help you quickly review status, media, and target channels.'}
              </p>

              <div className="relative max-w-sm" data-testid="posts-search-input">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === 'vi' ? 'Tìm theo tiêu đề, nội dung hoặc tên kênh...' : 'Search by title, content, or channel name...'}
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2" data-testid="posts-status-filters">
              {[
                'all',
                'draft',
                'scheduled',
                'queued',
                'posting',
                'published',
                'failed',
                'cancelled',
                'needs_verification',
              ].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'all' ? (language === 'vi' ? 'Tất cả' : 'All') : statusLabel(status, language)}
                </Button>
              ))}
            </div>

              <div className="space-y-2" data-testid="posts-channel-filters">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {language === 'vi' ? 'Bộ lọc kênh / nền tảng' : 'Channel / platform filter'}
                </p>
                <div className="flex flex-wrap gap-2">
                {['all', 'facebook', 'tiktok', 'simulation'].map((platform) => (
                  <Button
                    key={platform}
                    variant={platformFilter === platform ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPlatformFilter(platform)}
                  >
                    {platform === 'all'
                      ? (language === 'vi' ? 'Tất cả nền tảng' : 'All Platforms')
                      : platform === 'simulation'
                        ? (language === 'vi' ? 'Mô phỏng' : 'Simulation')
                        : platform}
                  </Button>
                ))}
              </div>
            </div>

              <div className="space-y-2" data-testid="posts-media-filters">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {language === 'vi' ? 'Bộ lọc media' : 'Media filter'}
                </p>
                <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: language === 'vi' ? 'Tất cả media' : 'All media' },
                  { key: 'none', label: language === 'vi' ? 'Không media' : 'No media' },
                  { key: 'photo', label: language === 'vi' ? 'Ảnh' : 'Images' },
                  { key: 'video', label: language === 'vi' ? 'Video' : 'Videos' },
                ].map((mediaOption) => (
                  <Button
                    key={mediaOption.key}
                    variant={mediaTypeFilter === mediaOption.key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMediaTypeFilter(mediaOption.key)}
                  >
                    {mediaOption.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {loading ? (
            <div className="so9-state-card py-12 text-sm text-muted-foreground">
              {language === 'vi' ? 'Đang tải bài viết…' : 'Loading posts…'}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="so9-state-card py-12 text-center">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">
                {language === 'vi' ? 'Không tìm thấy bài viết' : 'No posts found'}
              </h3>
              <p className="mb-2 text-sm text-muted-foreground">
                {searchQuery || statusFilter !== 'all' || platformFilter !== 'all' || mediaTypeFilter !== 'all'
                  ? language === 'vi' ? 'Hãy thử điều chỉnh bộ lọc kênh, trạng thái hoặc media.' : 'Try adjusting the channel, status, or media filters.'
                  : language === 'vi' ? 'Hãy tạo bài viết đầu tiên để bắt đầu.' : 'Create your first post to get started.'}
              </p>
              <p className="mb-4 text-xs text-muted-foreground">
                {language === 'vi'
                  ? 'Trang này chỉ hiển thị bản ghi cục bộ an toàn và không thực hiện remote edit/delete trên Facebook.'
                  : 'This page shows safe local records only and does not perform remote Facebook edit/delete.'}
              </p>
              {!searchQuery && statusFilter === 'all' && platformFilter === 'all' && mediaTypeFilter === 'all' && (
                <Button onClick={() => navigate('/create-post')}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createPost', language)}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => {
                const primaryTarget = getPrimaryTarget(post);

                return (
                  <div
                    key={post.id}
                    role="button"
                    tabIndex={0}
                    className={`flex items-start gap-4 rounded-[24px] border bg-[#fcfdff] p-4 transition-colors hover:bg-accent cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0065ff] focus:ring-offset-2 ${
                      selectedPersistedPostIds.includes(post.id) ? 'border-[#0065ff] bg-accent/40' : ''
                    }`}
                    onClick={() => void handleViewPost(post.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleViewPost(post.id);
                      }
                    }}
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <label
                          className={`flex min-w-[140px] items-center gap-2 rounded-full border px-2 py-1 text-xs font-medium ${
                            selectedPersistedPostIds.includes(post.id)
                              ? 'border-[#0065ff] bg-[#0065ff]/10 text-[#0065ff]'
                              : 'border-border text-muted-foreground'
                          }`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPersistedPostIds.includes(post.id)}
                            disabled={
                              !selectedPersistedPostIds.includes(post.id) &&
                              selectedPersistedPostIds.length >= CONTROLLED_BULK_PUBLISH_BATCH_LIMIT
                            }
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => togglePersistedPostSelection(post.id)}
                          />
                          <span>
                            {selectedPersistedPostIds.includes(post.id)
                              ? language === 'vi'
                                ? 'Đã chọn để review'
                                : 'Selected for review'
                              : language === 'vi'
                                ? 'Chọn để review'
                                : 'Select for review'}
                          </span>
                        </label>
                        <h3 className="font-semibold">{post.title || (language === 'vi' ? 'Bài viết chưa có tiêu đề' : 'Untitled Post')}</h3>
                        <Badge
                          variant={statusColors[post.status as keyof typeof statusColors] ?? 'outline'}
                        >
                          {statusLabel(post.status, language)}
                        </Badge>
                        <Badge variant="outline">{getSafeMediaLabel(post, language)}</Badge>
                        {post.status === 'needs_verification' ? (
                          <Badge variant="destructive">
                            {language === 'vi' ? 'Mở Facebook để kiểm tra' : 'Open Facebook to verify'}
                          </Badge>
                        ) : null}
                      </div>

                      <p className="line-clamp-2 text-sm text-muted-foreground">{post.content}</p>

                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">{language === 'vi' ? 'Kênh đích:' : 'Target channel:'}</span>{' '}
                          {primaryTarget?.targetType === 'page'
                            ? `${primaryTarget.pageName ?? (language === 'vi' ? 'Kênh Facebook đã chọn' : 'Selected Facebook channel')} · ${maskIdentifier(primaryTarget.pageId)}`
                            : primaryTarget
                              ? `${language === 'vi' ? 'Đích tài khoản cũ' : 'Legacy account target'} · ${primaryTarget.accountName}`
                              : language === 'vi' ? 'Đích không rõ' : 'Unknown target'}
                        </div>

                        {primaryTarget?.pageCategory ? (
                          <div>{language === 'vi' ? 'Danh mục' : 'Category'}: {primaryTarget.pageCategory}</div>
                        ) : null}

                        {primaryTarget?.sourceAccountName ? (
                          <div>{language === 'vi' ? 'Tài khoản nguồn' : 'Source account'}: {primaryTarget.sourceAccountName}</div>
                        ) : null}

                        <div className="rounded-md border border-dashed border-[#d9e7ff] bg-[#f8fbff] px-3 py-2 text-xs">
                          {language === 'vi'
                            ? 'Detail-safe: mở chi tiết để xem timeline, media metadata và recovery actions cục bộ.'
                            : 'Detail-safe: open the detail view to inspect timeline, media metadata, and local recovery actions.'}
                        </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {post.scheduledAt
                          ? new Date(post.scheduledAt).toLocaleString()
                          : language === 'vi' ? 'Không có lịch' : 'No schedule'}
                      </div>
                      <div>{language === 'vi' ? 'Tạo lúc' : 'Created'}: {new Date(post.createdAt).toLocaleString()}</div>
                    </div>

                    {post.mediaType === 'video' ? (
                      <div className="rounded-md border border-amber-300 bg-amber-50/60 p-2 text-xs text-amber-700">
                        <p className="font-medium">
                          {language === 'vi'
                            ? 'Đăng video Facebook'
                            : 'Facebook video publish'}
                        </p>
                        <p className="mt-1">
                          {language === 'vi'
                            ? 'Facebook có thể hiển thị video mới dưới dạng Reels. App không khẳng định native Reels API support riêng.'
                            : 'Facebook may show new videos as Reels. This app does not claim native Reels API support.'}
                        </p>
                        <div className="mt-1 grid gap-1 md:grid-cols-2">
                          <p>{language === 'vi' ? 'Tên tệp' : 'File name'}: {post.mediaFileName ?? '—'}</p>
                          <p>{language === 'vi' ? 'Kích thước' : 'File size'}: {formatMediaFileSize(post.mediaFileSize, language)}</p>
                          <p>{language === 'vi' ? 'MIME type' : 'MIME type'}: {post.mediaMimeType ?? '—'}</p>
                          <p>{language === 'vi' ? 'Phần mở rộng' : 'Extension'}: {post.mediaExtension ?? '—'}</p>
                          <p className="md:col-span-2">{language === 'vi' ? 'Thời lượng' : 'Duration'}: {formatMediaDuration(post.mediaDurationMs, language)}</p>
                        </div>
                      </div>
                    ) : null}

                    {post.errorMessage ? (
                          <div className="text-destructive">{language === 'vi' ? 'Lỗi gần nhất' : 'Last error'}: {post.errorMessage}</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePostNow(post);
                        }}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {post.status === 'needs_verification'
                          ? language === 'vi'
                            ? 'Mở chi tiết để kiểm tra'
                            : 'Open detail to verify'
                          : t('postNow', language)}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleViewPost(post.id);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {language === 'vi' ? 'Xem chi tiết' : 'View Details'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleCopyPost(post);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeletePost(post.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}