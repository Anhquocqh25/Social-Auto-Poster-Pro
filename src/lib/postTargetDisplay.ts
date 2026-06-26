import type { PostTargetSnapshot } from '@/types/electron';

export function maskPostTargetIdentifier(value: string | null | undefined) {
  if (!value) {
    return 'Unknown';
  }

  if (value.length <= 6) {
    return `••${value.slice(-2)}`;
  }

  return `${value.slice(0, 2)}••••${value.slice(-4)}`;
}

export function getPersistedPageTargets(postTargets?: PostTargetSnapshot[]) {
  return (postTargets ?? []).filter(
    (target): target is PostTargetSnapshot & { targetType: 'page'; pageId?: string | null } =>
      target.targetType === 'page'
  );
}

export function formatPersistedPageTargetLabel(target: Pick<PostTargetSnapshot, 'pageId' | 'pageName'>) {
  const maskedPageId = maskPostTargetIdentifier(target.pageId);

  if (target.pageName && target.pageName.trim().length > 0) {
    return `${target.pageName} · ${maskedPageId}`;
  }

  return maskedPageId;
}

export function getPostTargetDisplayLabels(postTargets?: PostTargetSnapshot[]) {
  const pageTargets = getPersistedPageTargets(postTargets);

  if (pageTargets.length > 0) {
    return pageTargets.map((target) => formatPersistedPageTargetLabel(target));
  }

  const legacyTarget = (postTargets ?? []).find((target) => target.targetType !== 'page');
  if (!legacyTarget) {
    return [];
  }

  return [legacyTarget.accountName];
}

export function getPostTargetSummaryLabel(
  postTargets: PostTargetSnapshot[] | undefined,
  language: 'vi' | 'en'
) {
  const labels = getPostTargetDisplayLabels(postTargets);
  const pageTargets = getPersistedPageTargets(postTargets);

  if (labels.length === 0) {
    return language === 'vi' ? 'Đích không rõ' : 'Unknown target';
  }

  if (pageTargets.length <= 1) {
    return labels[0];
  }

  return language === 'vi'
    ? `${pageTargets.length} Trang: ${labels.join(', ')}`
    : `${pageTargets.length} Pages: ${labels.join(', ')}`;
}

export function replacePostSnapshotInList<T extends { id: number }>(
  posts: T[],
  refreshedPost: T
): T[] {
  return posts.map((post) => (post.id === refreshedPost.id ? refreshedPost : post));
}
