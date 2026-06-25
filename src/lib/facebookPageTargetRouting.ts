import type {
  FacebookPageTargetOption,
  PostTargetPageSnapshot,
  PostTargetSnapshot,
} from '@/types/electron';

type FacebookPageIdentity = Pick<FacebookPageTargetOption, 'sourceAccountId' | 'pageId'>;
type EditableFacebookPageTargetSnapshot = PostTargetSnapshot & {
  targetType: 'page';
  pageId: string;
  pageName: string;
};

export function getFacebookTargetKey(page: FacebookPageIdentity) {
  return `${page.sourceAccountId}:${page.pageId}`;
}

export function dedupeFacebookTargetKeys(targetKeys: string[]) {
  return Array.from(new Set(targetKeys.filter((key) => key.trim().length > 0)));
}

export function toggleFacebookTargetSelection(
  selectedTargetKeys: string[],
  page: FacebookPageIdentity
) {
  const targetKey = getFacebookTargetKey(page);

  if (selectedTargetKeys.includes(targetKey)) {
    return selectedTargetKeys.filter((key) => key !== targetKey);
  }

  return dedupeFacebookTargetKeys([...selectedTargetKeys, targetKey]);
}

export function getSelectedFacebookPages(
  facebookPages: FacebookPageTargetOption[],
  selectedTargetKeys: string[]
) {
  const selectedKeySet = new Set(dedupeFacebookTargetKeys(selectedTargetKeys));
  return facebookPages.filter((page) => selectedKeySet.has(getFacebookTargetKey(page)));
}

export function buildExplicitFacebookPageTargets(
  selectedPages: FacebookPageTargetOption[]
): PostTargetPageSnapshot[] {
  const dedupedTargets = new Map<string, PostTargetPageSnapshot>();

  selectedPages.forEach((page) => {
    dedupedTargets.set(getFacebookTargetKey(page), {
      platform: 'facebook',
      targetType: 'page',
      accountId: page.sourceAccountId,
      pageId: page.pageId,
      pageName: page.pageName ?? 'Unnamed Facebook Page',
      sourceAccountName: page.sourceAccountName,
    });
  });

  return Array.from(dedupedTargets.values());
}

export function getUniqueTargetAccountsFromPageTargets(
  pageTargets: Array<Pick<PostTargetPageSnapshot, 'accountId'>>
) {
  return Array.from(new Set(pageTargets.map((target) => target.accountId)));
}

export function buildEditableFacebookPageTargets(
  postTargets: PostTargetSnapshot[] | undefined
): PostTargetPageSnapshot[] {
  const pageTargets = (postTargets ?? []).filter(
    (target): target is EditableFacebookPageTargetSnapshot =>
      target.targetType === 'page' && !!target.pageId && !!target.pageName
  );

  const dedupedTargets = new Map<string, PostTargetPageSnapshot>();

  pageTargets.forEach((target) => {
    dedupedTargets.set(`${target.accountId}:${target.pageId}`, {
      platform: 'facebook',
      targetType: 'page',
      accountId: target.accountId,
      pageId: target.pageId,
      pageName: target.pageName,
      sourceAccountName: target.sourceAccountName ?? undefined,
    });
  });

  return Array.from(dedupedTargets.values());
}

export function buildSelectedTargetKeysFromPostTargets(
  postTargets: PostTargetSnapshot[] | undefined
) {
  return buildEditableFacebookPageTargets(postTargets).map((target) => `${target.accountId}:${target.pageId}`);
}