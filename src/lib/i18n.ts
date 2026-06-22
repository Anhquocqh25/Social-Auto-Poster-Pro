import { getCurrentLanguage, type Language } from '@/store/useLanguageStore';

type TranslationValue = string | Record<Language, string>;

const translations: Record<string, TranslationValue> = {
  appTaglineSafeMode: {
    vi: 'Social Auto Poster Pro · Mặc định tắt đăng thật',
    en: 'Social Auto Poster Pro · Real publishing disabled by default',
  },
  diagnostics: {
    vi: 'Chẩn đoán',
    en: 'Diagnostics',
  },
  notifications: {
    vi: 'Thông báo',
    en: 'Notifications',
  },
  realRuntimeNotifications: {
    vi: 'Thông báo runtime thật, mới nhất ở trên cùng',
    en: 'Real runtime notifications, newest first',
  },
  markAllRead: {
    vi: 'Đánh dấu đã đọc',
    en: 'Mark all read',
  },
  clearAll: {
    vi: 'Xóa tất cả',
    en: 'Clear all',
  },
  loadingNotifications: {
    vi: 'Đang tải thông báo…',
    en: 'Loading notifications…',
  },
  noNotificationsYet: {
    vi: 'Chưa có thông báo nào.',
    en: 'No notifications yet.',
  },
  unread: {
    vi: 'Chưa đọc',
    en: 'Unread',
  },
  notificationMarkedRead: {
    vi: 'Đã đánh dấu thông báo là đã đọc.',
    en: 'Notification marked as read.',
  },
  notificationsMarkedRead: {
    vi: 'Đã đánh dấu tất cả thông báo là đã đọc.',
    en: 'Notifications marked as read.',
  },
  notificationCleared: {
    vi: 'Đã xóa thông báo.',
    en: 'Notification cleared.',
  },
  allNotificationsCleared: {
    vi: 'Đã xóa tất cả thông báo.',
    en: 'All notifications cleared.',
  },
  failedToLoadNotifications: {
    vi: 'Không thể tải thông báo',
    en: 'Failed to load notifications',
  },
  failedToMarkNotificationRead: {
    vi: 'Không thể đánh dấu thông báo là đã đọc',
    en: 'Failed to mark notification as read',
  },
  failedToMarkNotificationsRead: {
    vi: 'Không thể đánh dấu thông báo là đã đọc',
    en: 'Failed to mark notifications read',
  },
  failedToClearNotification: {
    vi: 'Không thể xóa thông báo',
    en: 'Failed to clear notification',
  },
  failedToClearNotifications: {
    vi: 'Không thể xóa thông báo',
    en: 'Failed to clear notifications',
  },
  dashboard: {
    vi: 'Bảng tin',
    en: 'Dashboard',
  },
  createPost: {
    vi: 'Tạo bài viết',
    en: 'Create Post',
  },
  posts: {
    vi: 'Bài viết',
    en: 'Posts',
  },
  accounts: {
    vi: 'Kênh kết nối',
    en: 'Accounts',
  },
  settings: {
    vi: 'Cài đặt',
    en: 'Settings',
  },
  bulkCreate: {
    vi: 'Đăng hàng loạt',
    en: 'Bulk Create',
  },
  scheduleCalendar: {
    vi: 'Lịch đăng',
    en: 'Calendar',
  },
  saveDraft: {
    vi: 'Lưu nháp',
    en: 'Save Draft',
  },
  postNow: {
    vi: 'Đăng ngay',
    en: 'Post Now',
  },
  schedulePost: {
    vi: 'Lên lịch đăng',
    en: 'Schedule Post',
  },
  selectPageChannel: {
    vi: 'Chọn Trang / Kênh đăng',
    en: 'Select Page / Channel',
  },
  selectedPageTargets: {
    vi: 'Trang đã chọn',
    en: 'Selected Page target(s)',
  },
  postContent: {
    vi: 'Nội dung bài viết',
    en: 'Post Content',
  },
  writeContentAndAddMedia: {
    vi: 'Soạn nội dung bài viết và thêm ảnh',
    en: 'Write your post content and add media',
  },
  titleOptional: {
    vi: 'Tiêu đề (Tùy chọn)',
    en: 'Title (Optional)',
  },
  content: {
    vi: 'Nội dung',
    en: 'Content',
  },
  hashtags: {
    vi: 'Hashtag',
    en: 'Hashtags',
  },
  media: {
    vi: 'Hình ảnh',
    en: 'Media',
  },
  pickImage: {
    vi: 'Chọn ảnh',
    en: 'Pick Image',
  },
  remove: {
    vi: 'Gỡ ảnh',
    en: 'Remove',
  },
  schedule: {
    vi: 'Lên lịch',
    en: 'Schedule',
  },
  date: {
    vi: 'Ngày',
    en: 'Date',
  },
  time: {
    vi: 'Giờ',
    en: 'Time',
  },
  createAndSchedulePosts: {
    vi: 'Tạo và lên lịch bài viết mạng xã hội',
    en: 'Create and schedule your social media posts',
  },
  selectImageFromComputer: {
    vi: 'Chọn ảnh từ máy tính của bạn',
    en: 'Select an image from your computer',
  },
  supportedImageFormats: {
    vi: 'Hỗ trợ: jpg, jpeg, png, webp · Tối đa 10 MB',
    en: 'Supported: jpg, jpeg, png, webp · Max 10 MB',
  },
  imageWillPublishOnePost: {
    vi: 'Ảnh này sẽ được dùng để đăng một bài lên Trang Facebook đã chọn.',
    en: 'This will publish one image post to the selected Facebook Page.',
  },
  realPublishDisabledHint: {
    vi: 'Đăng thật Facebook đang tắt. Đặt FACEBOOK_REAL_PUBLISH_ENABLED=true và khởi động lại ứng dụng để bật đăng thủ công.',
    en: 'Real Facebook publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable manual publish.',
  },
  noAutomaticPublish: {
    vi: 'Chỉ sẵn sàng cho một lần nhấn thủ công. Không có đăng tự động.',
    en: 'Ready for a manual click only. No automatic publishing is triggered.',
  },
  chooseFacebookPageTarget: {
    vi: 'Chọn Trang Facebook đích để đăng',
    en: 'Choose the Facebook Page channel to target',
  },
  selectAuthorizedPages: {
    vi: 'Chọn một hoặc nhiều Trang Facebook đã được cấp quyền. Tài khoản nguồn chỉ hiển thị như metadata.',
    en: 'Select one or more authorized Facebook Page targets. Source account is shown only as metadata.',
  },
  noAuthorizedPages: {
    vi: 'Chưa có Trang Facebook nào được lưu. Vào Kênh kết nối → Facebook → Trang và làm mới danh sách Trang nếu cần.',
    en: 'No authorized Facebook Pages are available yet. Open Accounts → Facebook → Pages and refresh Pages if needed.',
  },
  defaultLabel: {
    vi: '· Mặc định',
    en: '· Default',
  },
  unknownCategory: {
    vi: 'Chưa rõ danh mục',
    en: 'Unknown category',
  },
  sourceAccount: {
    vi: 'Tài khoản nguồn',
    en: 'Source account',
  },
  unnamedFacebookPage: {
    vi: 'Trang Facebook chưa đặt tên',
    en: 'Unnamed Facebook Page',
  },
  unknown: {
    vi: 'Chưa rõ',
    en: 'Unknown',
  },
  vi: 'VI',
  en: 'EN',
};

export function t(key: string, language?: Language): string {
  const currentLanguage = language ?? getCurrentLanguage();
  const value = translations[key];

  if (!value) {
    return key;
  }

  if (typeof value === 'string') {
    return value;
  }

  return value[currentLanguage] ?? value.vi ?? key;
}

export function statusLabel(status: string, language?: Language): string {
  const currentLanguage = language ?? getCurrentLanguage();

  const map: Record<string, { vi: string; en: string }> = {
    draft: { vi: 'Nháp', en: 'Draft' },
    scheduled: { vi: 'Đã lên lịch', en: 'Scheduled' },
    queued: { vi: 'Đang chờ', en: 'Queued' },
    posting: { vi: 'Đang đăng', en: 'Posting' },
    published: { vi: 'Đã đăng', en: 'Published' },
    failed: { vi: 'Thất bại', en: 'Failed' },
    cancelled: { vi: 'Đã hủy', en: 'Cancelled' },
    blocked: { vi: 'Bị chặn', en: 'Blocked' },
    partially_failed: { vi: 'Lỗi một phần', en: 'Partially failed' },
    needs_verification: { vi: 'Cần xác minh', en: 'Needs verification' },
    processing: { vi: 'Đang xử lý', en: 'Processing' },
    pending: { vi: 'Đang chờ', en: 'Pending' },
    success: { vi: 'Thành công', en: 'Success' },
  };

  return map[status]?.[currentLanguage] ?? status;
}