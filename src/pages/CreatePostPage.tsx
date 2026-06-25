import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Hash, Save, Send, Upload, X } from 'lucide-react';
import { getElectronAPI } from '@/lib/electronApi';
import { t } from '@/lib/i18n';
import { useLanguageStore } from '@/store/useLanguageStore';
import type { FacebookPageTargetOption, PostTargetPageSnapshot } from '@/types/electron';

function maskIdentifier(value: string | null | undefined) {
  if (!value) {
    return 'Unknown';
  }

  if (value.length <= 6) {
    return `••${value.slice(-2)}`;
  }

  return `${value.slice(0, 2)}••••${value.slice(-4)}`;
}

function getAvatarFallback(name: string | null | undefined) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) {
    return 'PG';
  }

  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getFacebookTargetKey(page: Pick<FacebookPageTargetOption, 'sourceAccountId' | 'pageId'>) {
  return `${page.sourceAccountId}:${page.pageId}`;
}

export function CreatePostPage() {
  const electronAPI = getElectronAPI();
  const { language } = useLanguageStore();
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    hashtags: '',
    scheduledDate: '',
    scheduledTime: '',
  });

  const [mediaLocalPath, setMediaLocalPath] = useState<string>('');
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [mediaPickedType, setMediaPickedType] = useState<'photo' | 'video' | 'none'>('none');
  const [mediaFileName, setMediaFileName] = useState<string>('');
  const [mediaFileSize, setMediaFileSize] = useState<number | null>(null);
  const [mediaMimeType, setMediaMimeType] = useState<string>('');
  const [mediaExtension, setMediaExtension] = useState<string>('');
  const [mediaDurationMs, setMediaDurationMs] = useState<number | null>(null);
  const [selectedImages, setSelectedImages] = useState<
    Array<{
      id: number;
      mediaLocalPath: string;
      previewUrl: string;
      fileName: string;
      fileSizeBytes: number;
      mimeType: string;
      extension: string;
    }>
  >([]);
  const [postFormat, setPostFormat] = useState<'post' | 'story'>('post');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [facebookPages, setFacebookPages] = useState<FacebookPageTargetOption[]>([]);
  const [selectedTargetKeys, setSelectedTargetKeys] = useState<string[]>([]);
  const [realPublishingEnabled, setRealPublishingEnabled] = useState<boolean | undefined>(undefined);
  const [publishingModeStatus, setPublishingModeStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [videoConfirmModalOpen, setVideoConfirmModalOpen] = useState(false);
  const [videoConfirmChecked, setVideoConfirmChecked] = useState(false);
  const [videoConfirmText, setVideoConfirmText] = useState('');

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const clearVideoMedia = () => {
    setMediaLocalPath('');
    setMediaPreview('');
    setMediaPickedType('none');
    setMediaFileName('');
    setMediaFileSize(null);
    setMediaMimeType('');
    setMediaExtension('');
    setMediaDurationMs(null);
  };

  const clearImageMedia = () => {
    setSelectedImages([]);
    if (mediaPickedType === 'photo') {
      setMediaLocalPath('');
      setMediaPreview('');
      setMediaPickedType('none');
      setMediaFileName('');
      setMediaFileSize(null);
      setMediaMimeType('');
      setMediaExtension('');
      setMediaDurationMs(null);
    }
  };

  const applySelectedImages = (
    images: Array<{
      id: number;
      mediaLocalPath: string;
      previewUrl: string;
      fileName: string;
      fileSizeBytes: number;
      mimeType: string;
      extension: string;
    }>
  ) => {
    const firstImage = images[0];
    setSelectedImages(images);
    setMediaPickedType(images.length > 0 ? 'photo' : 'none');
    setMediaLocalPath(firstImage?.mediaLocalPath ?? '');
    setMediaPreview(firstImage?.previewUrl ?? '');
    setMediaFileName(firstImage?.fileName ?? '');
    setMediaFileSize(firstImage?.fileSizeBytes ?? null);
    setMediaMimeType(firstImage?.mimeType ?? '');
    setMediaExtension(firstImage?.extension ?? '');
    setMediaDurationMs(null);
  };

  const applySelectedVideo = (video: {
    mediaLocalPath: string;
    previewUrl: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    extension: string;
    durationMs?: number;
  }) => {
    setSelectedImages([]);
    setMediaLocalPath(video.mediaLocalPath);
    setMediaPreview(video.previewUrl);
    setMediaPickedType('video');
    setMediaFileName(video.fileName);
    setMediaFileSize(video.fileSizeBytes);
    setMediaMimeType(video.mimeType);
    setMediaExtension(video.extension);
    setMediaDurationMs(video.durationMs ?? null);
  };

  const handlePickUnifiedMedia = async (targetType?: 'images' | 'video') => {
    try {
      setStatusMessage(null);

      const allowImages = targetType !== 'video';
      const allowVideo = targetType !== 'images';

      const result = await electronAPI.media.pickMedia({
        allowImages,
        allowVideo,
        multipleImages: true,
        maxVideos: 1,
      });

      if (result.cancelled) {
        return;
      }

      if (result.validationError) {
        setStatusMessage(result.validationError);
        return;
      }

      if (result.video) {
        if (selectedImages.length > 0) {
          const confirmed = window.confirm(
            language === 'vi'
              ? 'Chọn video sẽ xóa tất cả ảnh đã chọn. Bạn có muốn tiếp tục không?'
              : 'Selecting a video will remove the selected images. Do you want to continue?'
          );

          if (!confirmed) {
            return;
          }
        }

        clearImageMedia();
        applySelectedVideo(result.video);
        return;
      }

      if (result.images.length > 0) {
        if (mediaPickedType === 'video' && mediaLocalPath) {
          const confirmed = window.confirm(
            language === 'vi'
              ? 'Chọn ảnh sẽ xóa video đã chọn. Bạn có muốn tiếp tục không?'
              : 'Selecting images will remove the selected video. Do you want to continue?'
          );

          if (!confirmed) {
            return;
          }
        }

        clearVideoMedia();
        applySelectedImages(result.images);
      }
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to pick media');
    }
  };

  const handleRemoveMedia = () => {
    clearImageMedia();
    clearVideoMedia();
  };

  const buildScheduledAt = () => {
    if (!formData.scheduledDate || !formData.scheduledTime) return undefined;
    return new Date(`${formData.scheduledDate}T${formData.scheduledTime}:00`).toISOString();
  };

  const getSelectedPages = () => {
    return facebookPages.filter((page) => selectedTargetKeys.includes(getFacebookTargetKey(page)));
  };

  const getTargetAccounts = () => {
    return Array.from(new Set(getSelectedPages().map((page) => page.sourceAccountId)));
  };

  const validateCommonForm = () => {
    const hasMedia =
      (mediaPickedType === 'video' && !!mediaLocalPath.trim()) ||
      (mediaPickedType === 'photo' && selectedImages.length > 0);

    if (postFormat === 'story') {
      if (!hasMedia) {
        return language === 'vi'
          ? 'Tin cần một ảnh hoặc một video. Đăng Tin chưa được hỗ trợ với kết nối Facebook hiện tại, nhưng bạn vẫn có thể lưu nội dung cục bộ.'
          : 'A Story requires one image or one video. Story publishing is not supported by the current Facebook connection, but you can still save the content locally.';
      }

      if (selectedImages.length > 1) {
        return language === 'vi'
          ? 'Tin hiện chỉ hỗ trợ đúng một ảnh hoặc một video.'
          : 'Story currently supports exactly one image or one video.';
      }
    }

    if (!formData.content.trim() && !hasMedia) {
      return 'Post content or media is required.';
    }

    const selectedPages = getSelectedPages();
    if (selectedPages.length === 0) {
      return language === 'vi'
        ? 'Bạn chưa chọn kênh đăng. Hãy chọn một kênh trước khi lưu, lên lịch hoặc đăng.'
        : 'No publishing channel selected. Choose a channel before saving, scheduling or publishing.';
    }

    return null;
  };

  const detectMediaType = (): 'photo' | 'video' | 'none' => {
    return mediaPickedType;
  };

  useEffect(() => {
    const loadPublishingMode = async () => {
      console.info('[CreatePostPage] getConnectionStatus start');

      try {
        const connectionStatus = await Promise.race([
          electronAPI.accounts.getConnectionStatus(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timed out while loading Facebook publishing mode.')), 5000)
          ),
        ]);

        console.info('[CreatePostPage] connectionStatus loaded=true');
        console.info(
          '[CreatePostPage] facebook.realPublishingEnabled=%s',
          connectionStatus.facebook.realPublishingEnabled ? 'true' : 'false'
        );

        setRealPublishingEnabled(connectionStatus.facebook.realPublishingEnabled);
        setPublishingModeStatus('loaded');
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to verify Facebook publishing mode.';

        console.info('[CreatePostPage] connectionStatus loaded=false');
        console.info('[CreatePostPage] facebook.realPublishingEnabled=undefined');
        console.info('[CreatePostPage] getConnectionStatus error=%s', message);

        setRealPublishingEnabled(undefined);
        setPublishingModeStatus('error');
      }
    };

    const loadTargets = async () => {
      try {
        const pageData = await electronAPI.accounts.listFacebookPageTargets();

        setFacebookPages(pageData);
        setSelectedTargetKeys([]);
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : 'Failed to load available Facebook Pages'
        );
      }
    };

    void loadPublishingMode();
    void loadTargets();
  }, []);

  useEffect(() => {
    const bannerMode =
      publishingModeStatus === 'loading'
        ? 'loading'
        : publishingModeStatus === 'error'
          ? 'error'
          : realPublishingEnabled
            ? 'enabled'
            : 'disabled';

    console.info('[CreatePostPage] bannerMode=%s', bannerMode);
  }, [publishingModeStatus, realPublishingEnabled]);

  const togglePageSelection = (page: FacebookPageTargetOption) => {
    const targetKey = getFacebookTargetKey(page);
    setSelectedTargetKeys((prev) =>
      prev.includes(targetKey)
        ? prev.filter((key) => key !== targetKey)
        : [...prev, targetKey]
    );
  };

  const resetVideoConfirmation = () => {
    setVideoConfirmModalOpen(false);
    setVideoConfirmChecked(false);
    setVideoConfirmText('');
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      hashtags: '',
      scheduledDate: '',
      scheduledTime: '',
    });
    setMediaLocalPath('');
    setMediaPreview('');
    setMediaPickedType('none');
    setMediaFileName('');
    setMediaFileSize(null);
    setMediaMimeType('');
    setMediaExtension('');
    setMediaDurationMs(null);
    setSelectedImages([]);
    setPostFormat('post');
    resetVideoConfirmation();
  };

  const createPostPayload = (
    status: 'draft' | 'scheduled' | 'queued' | 'posting',
    scheduledAt?: string
  ) => {
    const selectedPages = getSelectedPages();
    const pageTargets: PostTargetPageSnapshot[] = selectedPages.map((page) => ({
      platform: 'facebook',
      targetType: 'page',
      accountId: page.sourceAccountId,
      pageId: page.pageId,
      pageName: page.pageName ?? 'Unnamed Facebook Page',
      sourceAccountName: page.sourceAccountName,
    }));

    console.info(
      '[CreatePostPage] selectedTargets=%o',
      pageTargets.map((target) => ({
        accountId: target.accountId,
        pageId: target.pageId,
        pageName: target.pageName,
      }))
    );

    return {
      title: formData.title || undefined,
      content: formData.content,
      postFormat,
      hashtags: formData.hashtags || undefined,
      mediaType: detectMediaType(),
      mediaLocalPath:
        mediaPickedType === 'video'
          ? mediaLocalPath || undefined
          : selectedImages[0]?.mediaLocalPath || undefined,
      mediaFileName:
        mediaPickedType === 'video'
          ? mediaFileName || undefined
          : selectedImages.map((image) => image.fileName).join(' | ') || undefined,
      mediaFileSize:
        mediaPickedType === 'video'
          ? mediaFileSize ?? undefined
          : selectedImages.reduce((total, image) => total + image.fileSizeBytes, 0) || undefined,
      mediaMimeType:
        mediaPickedType === 'video'
          ? mediaMimeType || undefined
          : selectedImages.map((image) => image.mimeType).join(', ') || undefined,
      mediaExtension:
        mediaPickedType === 'video'
          ? mediaExtension || undefined
          : selectedImages.map((image) => image.extension).join(', ') || undefined,
      mediaDurationMs: mediaDurationMs ?? undefined,
      status,
      scheduledAt,
      targetAccounts: getTargetAccounts(),
      pageTargets,
    };
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      setStatusMessage(null);

      const validationError = validateCommonForm();
      if (validationError) {
        setStatusMessage(validationError);
        return;
      }

      await electronAPI.posts.create(createPostPayload('draft'));

      setStatusMessage('Draft saved successfully.');
      resetForm();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async () => {
    try {
      setSaving(true);
      setStatusMessage(null);

      const validationError = validateCommonForm();
      if (validationError) {
        setStatusMessage(validationError);
        return;
      }

      const scheduledAt = buildScheduledAt();
      if (!scheduledAt) {
        setStatusMessage('Please choose a schedule date and time.');
        return;
      }

      if (new Date(scheduledAt).getTime() <= Date.now()) {
        setStatusMessage(
          'Scheduled posts must use a future date and time. Use "Post Now" for immediate publishing.'
        );
        return;
      }

      await electronAPI.posts.create(createPostPayload('scheduled', scheduledAt));

      setStatusMessage('Scheduled post created successfully.');
      resetForm();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to schedule post');
    } finally {
      setSaving(false);
    }
  };

  const validateImmediatePublish = () => {
    const validationError = validateCommonForm();
    if (validationError) {
      return validationError;
    }

    const selectedPages = getSelectedPages();
    const hasRealFacebookTarget = selectedPages.some(
      (page) => !page.sourceAccountName.toLowerCase().includes('simulation') && !page.pageId.startsWith('fb_sim_')
    );

    if (hasRealFacebookTarget && publishingModeStatus !== 'loaded') {
      return 'Unable to verify Facebook publishing mode. Real publishing is blocked until config status loads successfully.';
    }

    if (hasRealFacebookTarget && !realPublishingEnabled) {
      return 'Real Facebook publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable manual publish.';
    }

    if (selectedPages.length !== 1) {
      return 'Select exactly one Facebook Page for manual real publishing.';
    }

    if ((mediaPickedType === 'photo' || mediaPickedType === 'video') && !mediaLocalPath) {
      return mediaPickedType === 'video'
        ? 'Video file not found. Please reattach the video.'
        : 'Local image file is missing. Reattach the image or save as draft.';
    }

    return null;
  };

  const createQueuedPostNow = async () => {
    await electronAPI.posts.create(createPostPayload('queued'));
    setStatusMessage('Post queued for immediate publishing.');
    resetForm();
  };

  const handlePostNow = async () => {
    try {
      setSaving(true);
      setStatusMessage(null);

      const immediateValidationError = validateImmediatePublish();
      if (immediateValidationError) {
        setStatusMessage(immediateValidationError);
        return;
      }

      if (mediaPickedType === 'video') {
        setVideoConfirmModalOpen(true);
        return;
      }

      await createQueuedPostNow();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to post now');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmVideoPublish = async () => {
    try {
      setSaving(true);
      setStatusMessage(null);

      const immediateValidationError = validateImmediatePublish();
      if (immediateValidationError) {
        setStatusMessage(immediateValidationError);
        resetVideoConfirmation();
        return;
      }

      if (mediaPickedType !== 'video') {
        setStatusMessage('Video confirmation is only available for one local video file.');
        resetVideoConfirmation();
        return;
      }

      if (!videoConfirmChecked || videoConfirmText.trim() !== 'PUBLISH VIDEO') {
        setStatusMessage(
          language === 'vi'
            ? 'Xác nhận đăng video Facebook chưa hoàn tất.'
            : 'Facebook video publish confirmation is incomplete.'
        );
        return;
      }

      await createQueuedPostNow();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to queue controlled video publish');
    } finally {
      setSaving(false);
    }
  };

  const isMediaImage = mediaPickedType === 'photo' && selectedImages.length > 0;
  const isMediaVideo = mediaPickedType === 'video' && !!mediaPreview;
  const hasPages = facebookPages.length > 0;
  const selectedPages = getSelectedPages();
  const hasRealFacebookTargetSelected = selectedPages.some(
    (page) =>
      !page.sourceAccountName.toLowerCase().includes('simulation') && !page.pageId.startsWith('fb_sim_')
  );
  const selectedPageLabel = selectedPages[0]?.pageName ?? (language === 'vi' ? 'Chưa chọn kênh đăng' : 'No publishing channel selected');

  const publishNowDisabledReason = useMemo(() => {
    if (selectedPages.length === 0) {
      return 'Select a Facebook Page first.';
    }

    if (!formData.content.trim() && mediaPickedType === 'none') {
      return 'Enter post content or attach media first.';
    }

    if (publishingModeStatus === 'loading') {
      return 'Checking Facebook publishing availability...';
    }

    if (publishingModeStatus === 'error') {
      return 'Unable to verify Facebook publishing mode. Real publishing is blocked until config status loads successfully.';
    }

    if ((mediaPickedType === 'photo' || mediaPickedType === 'video') && !mediaLocalPath) {
      return mediaPickedType === 'video'
        ? 'Video file not found. Please reattach the video.'
        : 'Local image file is missing. Reattach the image or save as draft.';
    }

    if ((mediaPickedType === 'photo' || mediaPickedType === 'video' || formData.content.trim()) && selectedPages.length !== 1) {
      return 'Select exactly one Facebook Page for manual real publishing.';
    }

    if (hasRealFacebookTargetSelected && !realPublishingEnabled) {
      return 'Real Facebook publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable manual publish.';
    }

    if (mediaPickedType === 'video') {
      return null;
    }

    return null;
  }, [
    selectedPages,
    formData.content,
    publishingModeStatus,
    mediaPickedType,
    hasRealFacebookTargetSelected,
    realPublishingEnabled,
  ]);

  return (
    <div className="so9-page">
      <section className="so9-hero-card">
        <p className="so9-hero-kicker">
          {language === 'vi' ? 'Đăng bài viết · unified media composer' : 'Create post · unified media composer'}
        </p>
        <div className="so9-responsive-stack mt-3">
          <div className="min-w-0">
            <h1 className="so9-hero-title">{t('createPost', language)}</h1>
            <p className="so9-hero-description">
              {language === 'vi'
                ? 'Một composer thống nhất cho Bài viết và Tin, với chọn kênh bắt buộc, nhiều ảnh hoặc một video, preview rõ ràng và xác nhận an toàn trước mọi lần publish thật.'
                : 'One unified composer for Posts and Stories, with required channel selection, multiple images or one video, clear previews, and explicit safety confirmation before any real publish.'}
            </p>
            <div className="so9-hero-actions">
              <Badge
                variant={realPublishingEnabled ? 'destructive' : 'success'}
                className="h-11 rounded-full border-white/20 bg-white/10 px-4 text-white normal-case tracking-normal"
              >
                {realPublishingEnabled
                  ? language === 'vi'
                    ? 'Đăng thật: Đang bật'
                    : 'Real publishing: On'
                  : language === 'vi'
                    ? 'Đăng thật: Đang tắt'
                    : 'Real publishing: Off'}
              </Badge>
              <div className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                {language === 'vi'
                  ? `Kênh đã chọn: ${selectedPages.length}`
                  : `Selected channels: ${selectedPages.length}`}
              </div>
              <div className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                {language === 'vi'
                  ? `Loại media: ${mediaPickedType === 'video' ? 'Video' : mediaPickedType === 'photo' ? 'Ảnh' : 'Chưa chọn'}`
                  : `Media type: ${mediaPickedType === 'video' ? 'Video' : mediaPickedType === 'photo' ? 'Image' : 'None selected'}`}
              </div>
            </div>
          </div>
        </div>
      </section>

      {publishingModeStatus === 'loading' ? (
        <Card className="so9-banner so9-banner-info border-0 shadow-none" data-testid="create-post-safety-banner">
          <CardContent className="pt-5">
            <p className="text-sm" data-testid="create-post-real-publish-status">
              {language === 'vi'
                ? 'Đang kiểm tra chế độ đăng Facebook...'
                : 'Checking Facebook publishing mode...'}
            </p>
          </CardContent>
        </Card>
      ) : publishingModeStatus === 'error' ? (
        <Card className="so9-banner so9-banner-danger border-0 shadow-none" data-testid="create-post-safety-banner">
          <CardContent className="pt-5">
            <p className="text-sm" data-testid="create-post-real-publish-status">
                {language === 'vi'
                  ? 'Không thể xác minh chế độ đăng Facebook. Đăng thật bị chặn cho đến khi trạng thái cấu hình tải thành công.'
                  : 'Unable to verify Facebook publishing mode. Real publishing is blocked until config status loads successfully.'}
              </p>
          </CardContent>
        </Card>
      ) : realPublishingEnabled ? (
        <Card className="so9-banner so9-banner-warning border-0 shadow-none" data-testid="create-post-safety-banner">
          <CardContent className="pt-5">
            <p className="text-sm font-medium" data-testid="create-post-real-publish-status">
                {language === 'vi'
                  ? 'Đăng thật Facebook có kiểm soát đang BẬT cho phiên này. Chỉ chọn đúng một Trang và chỉ đăng thủ công một bài.'
                  : 'Controlled real Facebook publishing is ENABLED for this session. Select exactly one Page and publish only one post manually.'}
              </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="so9-banner so9-banner-success border-0 shadow-none" data-testid="create-post-safety-banner">
          <CardContent className="pt-5">
            <p className="text-sm" data-testid="create-post-real-publish-status">
              {language === 'vi'
                ? 'Đăng thật Facebook vẫn đang tắt. Hãy chọn một Trang Facebook và chỉ lưu nháp hoặc metadata lịch đăng.'
                : 'Real Facebook publishing remains disabled. Select a Facebook Page and save a draft or schedule metadata only.'}
            </p>
            {!realPublishingEnabled && (
              <p
                className="mt-2 text-xs text-muted-foreground"
                data-testid="create-post-real-publish-disabled-message"
              >
                Real Facebook publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable manual publish.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {statusMessage && (
        <Card className="so9-banner so9-banner-danger border-0 shadow-none">
          <CardContent className="pt-6">
            <p className="text-sm">{statusMessage}</p>
          </CardContent>
        </Card>
      )}

      {videoConfirmModalOpen && mediaPickedType === 'video' ? (
        <div
          className="so9-modal-shell"
          data-testid="create-post-video-publish-modal"
        >
          <div className="so9-modal-card max-w-2xl">
            <div className="so9-modal-header mb-0 flex items-start justify-between gap-3">
              <div>
                <p className="so9-muted-label">{language === 'vi' ? 'Xác nhận đăng thật' : 'Real publish confirmation'}</p>
                <h3 className="mt-2 text-lg font-semibold">
                  {language === 'vi'
                    ? 'Xác nhận đăng video Facebook'
                    : 'Confirm Facebook video publish'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {language === 'vi'
                    ? 'Đăng video Facebook có kiểm soát — Facebook có thể hiển thị video mới dưới dạng Reels.'
                    : 'Controlled Facebook video publish — Facebook may show newly uploaded videos as Reels.'}
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={resetVideoConfirmation} disabled={saving}>
                {language === 'vi' ? 'Đóng' : 'Close'}
              </Button>
            </div>

            <div className="so9-modal-body space-y-4 text-sm">
              <div className="so9-modal-section">
                <p className="so9-modal-section-title">{language === 'vi' ? 'Đăng video Facebook' : 'Publish a Facebook video'}</p>
                <p className="mt-2 text-sm leading-6 text-[#62728b]">
                  {language === 'vi'
                    ? 'Facebook có thể hiển thị video mới dưới dạng Reels. App chỉ tạo job sau khi bạn hoàn tất checkbox và nhập chính xác PUBLISH VIDEO.'
                    : 'Facebook may display newly uploaded videos as Reels. The app creates no job until you complete the checkbox and exact PUBLISH VIDEO confirmation.'}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="so9-modal-section">
                  <p className="so9-modal-section-title">
                    {language === 'vi' ? 'Tóm tắt sẽ gửi' : 'What will be sent'}
                  </p>
                  <div className="mt-3 space-y-2 text-muted-foreground">
                    <p><span className="font-medium text-[#17233b]">{language === 'vi' ? 'Trang đích' : 'Target Page'}:</span> {selectedPages[0]?.pageName ?? 'Unknown'}</p>
                    <p><span className="font-medium text-[#17233b]">{language === 'vi' ? 'Tệp video' : 'Video file'}:</span> {mediaFileName || mediaLocalPath.split(/[/\\]/).pop() || 'Unknown'}</p>
                    <p><span className="font-medium text-[#17233b]">{language === 'vi' ? 'Kích thước' : 'File size'}:</span> {mediaFileSize ? `${(mediaFileSize / (1024 * 1024)).toFixed(2)} MB` : '—'}</p>
                    <p><span className="font-medium text-[#17233b]">{language === 'vi' ? 'MIME type' : 'MIME type'}:</span> {mediaMimeType || 'unknown'}</p>
                    <p><span className="font-medium text-[#17233b]">{language === 'vi' ? 'Thời lượng' : 'Duration'}:</span> {mediaDurationMs ? `${Math.floor(mediaDurationMs / 1000)}s` : '—'}</p>
                    <p><span className="font-medium text-[#17233b]">{language === 'vi' ? 'Xem trước caption' : 'Caption preview'}:</span> {formData.content.trim() || (language === 'vi' ? 'Chưa có nội dung' : 'No caption yet')}</p>
                    <p><span className="font-medium text-[#17233b]">{language === 'vi' ? 'Kiểu gửi' : 'Delivery mode'}:</span> {language === 'vi' ? 'Queue-backed controlled publish' : 'Queue-backed controlled publish'}</p>
                  </div>
                </div>

                <div className="so9-modal-section border-[#ffe3a5] bg-[#fff8e1] text-[#8a5b00]">
                  <p className="so9-modal-section-title text-[#8a5b00]">
                    {language === 'vi' ? 'Lưu ý upload và xác minh' : 'Upload and verification notes'}
                  </p>
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                    <li>
                      {language === 'vi'
                        ? 'Đúng 1 Facebook Page và đúng 1 video cục bộ.'
                        : 'Exactly one Facebook Page and exactly one local video.'}
                    </li>
                    <li>
                      {language === 'vi'
                        ? 'Upload đi qua queue, không có Graph call trực tiếp từ UI.'
                        : 'Upload is queue-backed, with no direct Graph call from the UI.'}
                    </li>
                    <li>
                      {language === 'vi'
                        ? 'App không remote edit/delete Facebook video.'
                        : 'The app does not remote edit/delete Facebook video posts.'}
                    </li>
                    <li>
                      {language === 'vi'
                        ? 'Local delete không xóa Facebook video đã đăng.'
                        : 'Local delete does not delete a published Facebook video.'}
                    </li>
                    <li>
                      {language === 'vi'
                        ? 'Nếu Facebook nhận video nhưng app chưa xác minh được trạng thái cuối, bài viết sẽ được đánh dấu Cần xác minh.'
                        : 'If Facebook accepts the video but the final state is not confirmed, the post will be marked Needs verification.'}
                    </li>
                  </ul>
                </div>
              </div>

              <label className="so9-modal-section flex items-start gap-2">
                <input
                  type="checkbox"
                  id="create-post-video-confirm-checkbox"
                  data-testid="create-post-video-confirm-checkbox"
                  checked={videoConfirmChecked}
                  onChange={(event) => setVideoConfirmChecked(event.target.checked)}
                  disabled={saving}
                  className="mt-1"
                />
                <span>
                  {language === 'vi'
                    ? 'Tôi hiểu rằng thao tác này sẽ đăng một video thật lên Facebook.'
                    : 'I understand this will publish a real video to Facebook.'}
                </span>
              </label>

              <div className="so9-form-field">
                <Label htmlFor="create-post-video-confirm-input">
                  {language === 'vi' ? 'Nhập chính xác PUBLISH VIDEO để xác nhận' : 'Type PUBLISH VIDEO to confirm'}
                </Label>
                <Input
                  id="create-post-video-confirm-input"
                  data-testid="create-post-video-confirm-input"
                  value={videoConfirmText}
                  onChange={(event) => setVideoConfirmText(event.target.value)}
                  placeholder="PUBLISH VIDEO"
                  autoComplete="off"
                  disabled={saving}
                  className="mt-1"
                />
              </div>

              <div className="so9-modal-footer border-0 px-0 pb-0 pt-2">
                <Button type="button" variant="outline" onClick={resetVideoConfirmation} disabled={saving}>
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  data-testid="create-post-video-confirm-button"
                  onClick={() => void handleConfirmVideoPublish()}
                  disabled={saving || !videoConfirmChecked || videoConfirmText.trim() !== 'PUBLISH VIDEO'}
                >
                  {language === 'vi' ? 'Xác nhận PUBLISH VIDEO' : 'Confirm PUBLISH VIDEO'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="so9-flat-card border-[#dce8ff] bg-[linear-gradient(180deg,rgba(245,249,255,0.96)_0%,rgba(255,255,255,0.96)_100%)]">
            <CardContent className="grid gap-3 p-5 md:grid-cols-5">
              {[
                language === 'vi' ? '1. Chọn định dạng' : '1. Choose format',
                language === 'vi' ? '2. Chọn kênh đăng' : '2. Choose publishing channel',
                language === 'vi' ? '3. Tải media' : '3. Upload media',
                language === 'vi' ? '4. Nhập nội dung' : '4. Enter content',
                language === 'vi' ? '5. Kiểm tra và lưu/đăng' : '5. Review and save/publish',
              ].map((step, index) => (
                <div
                  key={step}
                  className={`rounded-[20px] border px-4 py-3 ${index === 0 ? 'border-[#1f5eff] bg-[#eef4ff]' : 'border-[#e3ebf8] bg-white'}`}
                >
                  <p className="text-sm font-semibold text-[#17233b]">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="so9-flat-card">
            <CardHeader className="border-b border-[#e8eef8]">
              <CardTitle>
                {mediaPickedType === 'video'
                  ? language === 'vi'
                    ? 'Soạn nội dung và media'
                    : 'Compose content and media'
                  : t('postContent', language)}
              </CardTitle>
              <CardDescription>
                {mediaPickedType === 'video'
                    ? language === 'vi'
                      ? 'Dùng một khu vực media thống nhất: nhiều ảnh hoặc đúng một video, không trộn lẫn.'
                      : 'Use one unified media area: multiple images or exactly one video, never mixed.'
                    : t('writeContentAndAddMedia', language)}
              </CardDescription>
              {mediaPickedType === 'video' ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
                    <p className="so9-muted-label">{language === 'vi' ? 'Trang đã chọn' : 'Selected Page'}</p>
                    <p className="mt-2 text-sm font-semibold text-[#17233b]">{selectedPageLabel}</p>
                  </div>
                  <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
                    <p className="so9-muted-label">{language === 'vi' ? 'Tệp video' : 'Video file'}</p>
                    <p className="mt-2 truncate text-sm font-semibold text-[#17233b]">{mediaFileName || '—'}</p>
                  </div>
                  <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
                    <p className="so9-muted-label">{language === 'vi' ? 'Validation' : 'Validation'}</p>
                    <p className="mt-2 text-sm font-semibold text-[#17233b]">{mediaLocalPath ? (language === 'vi' ? 'Sẵn sàng kiểm tra' : 'Ready for review') : '—'}</p>
                  </div>
                  <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
                    <p className="so9-muted-label">{language === 'vi' ? 'Hành động tiếp theo' : 'Next step'}</p>
                    <p className="mt-2 text-sm font-semibold text-[#17233b]">{language === 'vi' ? 'Lưu nháp / lên lịch / đăng' : 'Save / schedule / publish'}</p>
                  </div>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="space-y-2">
                <Label htmlFor="title">{t('titleOptional', language)}</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder={language === 'vi' ? 'Đặt tiêu đề cho bài viết...' : 'Give your post a title...'}
                  value={formData.title}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">{t('content', language)}</Label>
                <Textarea
                  id="content"
                  name="content"
                  placeholder={language === 'vi' ? 'Bạn đang nghĩ gì?' : "What's on your mind?"}
                  className="min-h-[200px]"
                  value={formData.content}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hashtags">{t('hashtags', language)}</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="hashtags"
                    name="hashtags"
                      placeholder={language === 'vi' ? 'hashtag1 hashtag2 hashtag3' : 'hashtag1 hashtag2 hashtag3'}
                    className="pl-10"
                    value={formData.hashtags}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>{language === 'vi' ? 'Định dạng nội dung' : 'Content format'}</Label>
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        {
                          id: 'post' as const,
                          title: language === 'vi' ? 'Bài viết' : 'Post',
                          description:
                            language === 'vi'
                              ? 'Hỗ trợ văn bản, nhiều ảnh hoặc một video theo các quy tắc an toàn hiện có.'
                              : 'Supports text, multiple images, or one video under the existing safety rules.',
                        },
                        {
                          id: 'story' as const,
                          title: language === 'vi' ? 'Tin' : 'Story',
                          description:
                            language === 'vi'
                              ? 'Hiển thị nhưng hiện bị khóa vì kết nối Facebook hiện tại chưa hỗ trợ đăng Tin thật.'
                              : 'Visible but currently blocked because the current Facebook connection does not support real Story publishing.',
                        },
                      ].map((formatOption) => (
                        <button
                          key={formatOption.id}
                          type="button"
                          onClick={() => setPostFormat(formatOption.id)}
                          className={`rounded-[20px] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0065ff]/30 ${
                            postFormat === formatOption.id
                              ? 'border-[#0065ff] bg-[#eef4ff] shadow-[0_10px_30px_rgba(31,94,255,0.08)]'
                              : 'border-border bg-white hover:bg-muted/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{formatOption.title}</p>
                            {postFormat === formatOption.id ? (
                              <Badge
                                variant="outline"
                                className="border-[#0065ff] bg-white text-[#0065ff] normal-case tracking-normal"
                              >
                                {language === 'vi' ? 'Đang chọn' : 'Selected'}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {formatOption.description}
                          </p>
                        </button>
                      ))}
                    </div>
                    {postFormat === 'story' ? (
                      <div className="so9-banner so9-banner-warning border-0 shadow-none">
                        <CardContent className="px-0 pt-4">
                          <p className="text-sm">
                            {language === 'vi'
                              ? 'Đăng Tin chưa được hỗ trợ với kết nối Facebook hiện tại. Bạn vẫn có thể lưu nội dung cục bộ.'
                              : 'Story publishing is not supported by the current Facebook connection. You can still save the content locally.'}
                          </p>
                        </CardContent>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>{language === 'vi' ? 'Tải media' : 'Upload Media'}</Label>
                      {(isMediaImage || isMediaVideo) ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => void handlePickUnifiedMedia()}>
                          <Upload className="mr-2 h-4 w-4" />
                          {language === 'vi' ? 'Thay thế / thêm media' : 'Replace / add media'}
                        </Button>
                      ) : null}
                    </div>
                    <div className="so9-info-note text-xs">
                      {language === 'vi'
                        ? 'Chọn nhiều ảnh hoặc đúng một video. Ảnh và video không thể cùng tồn tại trong một bài viết.'
                        : 'Choose multiple images or exactly one video. Images and video cannot coexist in the same post.'}
                    </div>
                    {!mediaPreview ? (
                      <div className="so9-empty-state rounded-[24px] border-2 p-6">
                        <div className="so9-state-icon">
                          <Upload className="h-7 w-7 text-[#1f5eff]" />
                        </div>
                        <p className="so9-state-title mt-0 text-sm">
                          {language === 'vi'
                            ? 'Tải nhiều ảnh hoặc một video'
                            : 'Upload multiple images or one video'}
                        </p>
                        <p className="so9-state-description mt-0 text-xs">
                          {language === 'vi'
                            ? 'Ảnh hỗ trợ: JPG, JPEG, PNG, WEBP · Video hỗ trợ: MP4, MOV, WEBM, MKV'
                            : 'Supported images: JPG, JPEG, PNG, WEBP · Supported video: MP4, MOV, WEBM, MKV'}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button type="button" onClick={() => void handlePickUnifiedMedia()}>
                            <Upload className="mr-2 h-4 w-4" />
                            {language === 'vi' ? 'Tải media' : 'Upload Media'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {isMediaImage ? (
                          <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              {selectedImages.map((image) => (
                                <div key={image.id} className="rounded-[20px] border bg-white p-3">
                                  <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-[16px] border bg-muted/20">
                                    <img src={image.previewUrl} alt={image.fileName} className="h-full w-full object-cover" />
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      className="absolute right-2 top-2 h-8 w-8 rounded-full"
                                      onClick={() => {
                                        const nextImages = selectedImages.filter((item) => item.id !== image.id);
                                        if (nextImages.length === 0) {
                                          handleRemoveMedia();
                                          return;
                                        }
                                        applySelectedImages(nextImages);
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                    <p className="truncate font-medium text-foreground">{image.fileName}</p>
                                    <p>{(image.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</p>
                                    <p>{image.mimeType} · {image.extension}</p>
                                    <p>{language === 'vi' ? 'Hợp lệ' : 'Valid'}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="rounded-[20px] border bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                              <p>
                                {language === 'vi' ? 'Tổng số ảnh' : 'Total images'}:{' '}
                                <span className="font-medium text-foreground">{selectedImages.length}</span>
                              </p>
                            </div>
                          </div>
                        ) : null}
                        {isMediaVideo ? (
                          <div className="space-y-3">
                            <div className="relative mx-auto flex h-[280px] w-full max-w-[520px] items-center justify-center overflow-hidden rounded-[24px] border bg-muted/20 p-3">
                              <video src={mediaPreview} controls className="h-full w-full object-contain" />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute right-2 top-2"
                                onClick={handleRemoveMedia}
                              >
                                {t('remove', language)}
                              </Button>
                            </div>
                            <div className="rounded-[20px] border bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                              <div className="grid gap-1 md:grid-cols-2">
                                <p><span className="font-medium text-foreground">{language === 'vi' ? 'Tệp video' : 'Video file'}:</span> {mediaFileName || '—'}</p>
                                <p><span className="font-medium text-foreground">{language === 'vi' ? 'Kích thước' : 'File size'}:</span> {mediaFileSize ? `${(mediaFileSize / (1024 * 1024)).toFixed(2)} MB` : '—'}</p>
                                <p><span className="font-medium text-foreground">MIME:</span> {mediaMimeType || '—'}</p>
                                <p><span className="font-medium text-foreground">{language === 'vi' ? 'Phần mở rộng' : 'Extension'}:</span> {mediaExtension || '—'}</p>
                                <p><span className="font-medium text-foreground">{language === 'vi' ? 'Thời lượng' : 'Duration'}:</span> {mediaDurationMs ? `${Math.floor(mediaDurationMs / 1000)}s` : '—'}</p>
                                <p><span className="font-medium text-foreground">{language === 'vi' ? 'Trạng thái' : 'Validation'}:</span> {language === 'vi' ? 'Hợp lệ' : 'Valid'}</p>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="so9-flat-card">
            <CardHeader className="border-b border-[#e8eef8]">
              <CardTitle>{language === 'vi' ? 'Chọn kênh đăng' : 'Choose a publishing channel'}</CardTitle>
              <CardDescription>
                {language === 'vi'
                  ? 'Mỗi lần lưu, lên lịch hoặc đăng đều phải chọn rõ một kênh đăng. Publish Now dùng đúng 1 kênh để review và controlled publish rõ ràng.'
                  : 'Every save, schedule, or publish action requires an explicit channel. Publish Now uses exactly one channel for clear review and controlled publishing.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {hasPages
                    ? language === 'vi'
                      ? 'Danh sách này lấy từ Kết nối kênh và chỉ hiển thị các Trang Facebook đã được ứng dụng lưu cục bộ an toàn.'
                      : 'This list comes from Connected Channels and only shows Facebook Pages that the app has safely stored locally.'
                    : t('noAuthorizedPages', language)}
                </div>
                {hasPages ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="so9-state-inline">
                      <p className="so9-muted-label">{language === 'vi' ? 'Tổng kênh khả dụng' : 'Available channels'}</p>
                      <p className="mt-2 text-sm font-semibold text-[#17233b]">{facebookPages.length}</p>
                    </div>
                    <div className="so9-state-inline">
                      <p className="so9-muted-label">{language === 'vi' ? 'Kênh đang chọn' : 'Selected channels'}</p>
                      <p className="mt-2 text-sm font-semibold text-[#17233b]">{selectedPages.length}</p>
                    </div>
                    <div className="so9-state-inline">
                      <p className="so9-muted-label">{language === 'vi' ? 'Gợi ý Post Now' : 'Post Now guidance'}</p>
                      <p className="mt-2 text-sm font-semibold text-[#17233b]">
                        {selectedPages.length === 1
                          ? language === 'vi'
                            ? 'Đúng 1 kênh'
                            : 'Exactly one channel'
                          : language === 'vi'
                            ? 'Cần 1 kênh'
                            : 'Needs one channel'}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {hasPages ? (
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {facebookPages.map((page) => {
                    const checked = selectedTargetKeys.includes(getFacebookTargetKey(page));

                    return (
                      <label
                        key={`${page.sourceAccountId}-${page.pageId}`}
                        className={`flex items-start justify-between gap-3 rounded-[20px] border p-3 text-sm transition-colors ${
                          checked ? 'border-[#0065ff] bg-[#eef4ff]' : 'bg-white hover:border-[#cfe0ff]'
                        }`}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-[#eef4ff] text-xs font-semibold text-[#1f5eff]">
                            {page.pictureUrl ? (
                              <img
                                src={page.pictureUrl}
                                alt={page.pageName ?? t('unnamedFacebookPage', language)}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>{getAvatarFallback(page.pageName ?? t('unnamedFacebookPage', language))}</span>
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium">
                                {page.pageName ?? t('unnamedFacebookPage', language)}
                              </div>
                              {checked ? (
                                <Badge variant="outline" className="border-[#0065ff] bg-white text-[#0065ff] normal-case tracking-normal">
                                  {language === 'vi' ? 'Đã chọn' : 'Selected'}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {page.category ?? t('unknownCategory', language)} · {maskIdentifier(page.pageId)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t('sourceAccount', language)}: {page.sourceAccountName} · DB #{page.sourceAccountDbId}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {page.pageReadiness === 'ready'
                                ? language === 'vi'
                                  ? 'Sẵn sàng'
                                  : 'Ready'
                                : page.pageReadiness === 'missing_permissions'
                                  ? language === 'vi'
                                    ? 'Thiếu quyền'
                                    : 'Missing permissions'
                                  : language === 'vi'
                                    ? 'Cần kiểm tra'
                                    : 'Needs review'}
                            </div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePageSelection(page)}
                          className="mt-1"
                        />
                      </label>
                    );
                  })}
                </div>
              ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    {language === 'vi'
                      ? 'Chưa có Trang Facebook nào được lưu. Hãy làm mới Trang từ mục Kênh kết nối hoặc kết nối lại Facebook với quyền Trang.'
                      : 'No authorized Facebook Pages are stored yet. Refresh Pages from Accounts or reconnect Facebook with Page permissions.'}
                  </div>
              )}

              {selectedPages.length > 0 && (
                <div className="rounded-[20px] border bg-muted/20 p-3 text-sm">
                  <p className="font-medium">{language === 'vi' ? 'Kênh đã chọn' : 'Selected channels'}</p>
                  <ul className="mt-2 space-y-2 text-muted-foreground">
                    {selectedPages.map((page) => (
                      <li key={`${page.sourceAccountId}-${page.pageId}`} className="rounded-[16px] border border-[#e5ebf6] bg-white px-3 py-2">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-[#eef4ff] text-xs font-semibold text-[#1f5eff]">
                            {page.pictureUrl ? (
                              <img
                                src={page.pictureUrl}
                                alt={page.pageName ?? t('unnamedFacebookPage', language)}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>{getAvatarFallback(page.pageName ?? t('unnamedFacebookPage', language))}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-[#17233b]">
                                {page.pageName ?? t('unnamedFacebookPage', language)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {page.category ?? t('unknown', language)} · {maskIdentifier(page.pageId)}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {t('sourceAccount', language)}: {page.sourceAccountName}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {mediaPickedType === 'video' ? (
                <div className="so9-info-note text-xs">
                  {language === 'vi'
                      ? 'Video mode ưu tiên đúng 1 kênh Facebook để review và controlled publish rõ ràng. Nếu cần rà soát readiness, hãy mở Kết nối kênh trước khi đăng.'
                      : 'Video mode works best with exactly one Facebook channel for clear review and controlled publishing. If you need to review readiness, open Connected Channels before publishing.'}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="so9-flat-card">
            <CardHeader className="border-b border-[#e8eef8]">
              <CardTitle>{t('schedule', language)}</CardTitle>
              <CardDescription>
                {language === 'vi' ? 'Thời điểm đăng bài viết này' : 'When to publish this post'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="space-y-2">
                <Label htmlFor="scheduledDate">{t('date', language)}</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="scheduledDate"
                    name="scheduledDate"
                    type="date"
                    className="pl-10"
                    value={formData.scheduledDate}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduledTime">{t('time', language)}</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="scheduledTime"
                    name="scheduledTime"
                    type="time"
                    className="pl-10"
                    value={formData.scheduledTime}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="so9-flat-card">
            <CardHeader className="border-b border-[#e8eef8]">
              <CardTitle>{language === 'vi' ? 'Hành động xuất bản' : 'Publishing actions'}</CardTitle>
              <CardDescription>
                {language === 'vi'
                  ? 'Lưu nháp trước, lên lịch khi cần, và chỉ dùng Post Now khi mọi điều kiện an toàn của kênh, media và publishing mode đã đạt.'
                  : 'Save a draft first, schedule when needed, and use Post Now only when all channel, media, and publishing-mode safety conditions are satisfied.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
              <Button variant="ghost" className="w-full justify-start rounded-[18px]" onClick={handleSaveDraft} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {t('saveDraft', language)}
              </Button>
              <Button className="w-full justify-start rounded-[18px]" onClick={handleSchedule} disabled={saving}>
                <Calendar className="mr-2 h-4 w-4" />
                {t('schedulePost', language)}
              </Button>
              <div className="space-y-2 rounded-[18px] border border-[#e6edf8] bg-[#fbfdff] p-3">
                <Button
                  variant="outline"
                  className="w-full justify-start rounded-[18px]"
                  onClick={handlePostNow}
                  disabled={saving || !!publishNowDisabledReason}
                  data-testid="create-post-post-now-button"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {t('postNow', language)}
                </Button>
                {publishNowDisabledReason ? (
                  <p
                    className="text-xs leading-5 text-muted-foreground"
                    data-testid="create-post-post-now-disabled-reason"
                  >
                    {publishNowDisabledReason}
                  </p>
                ) : (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t('noAutomaticPublish', language)}
                  </p>
                )}
              </div>
              <div className="so9-info-note text-xs">
                {mediaPickedType === 'video'
                  ? language === 'vi'
                    ? 'Video: hiển thị tên tệp, dung lượng, MIME type, phần mở rộng và thời lượng khi có thể.'
                    : 'Video: file name, size, MIME type, extension, and duration are surfaced when available.'
                  : language === 'vi'
                    ? 'Ảnh và văn bản dùng cùng composer thống nhất với flow lưu nháp, lên lịch và controlled publish hiện có.'
                    : 'Images and text use the same unified composer with the existing draft, schedule, and controlled publish behavior.'}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}