const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const assert = require('assert');

function loadTypeScriptModule(relativePath) {
  const modulePath = path.join(process.cwd(), relativePath);
  const source = fs.readFileSync(modulePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (request) => {
      if (request === '@/types/electron') {
        return {};
      }
      return require(request);
    },
    console,
    process,
    __dirname: path.dirname(modulePath),
    __filename: modulePath,
  });

  new vm.Script(transpiled.outputText, { filename: modulePath }).runInContext(context);
  return module.exports;
}

function loadHelperModule() {
  return loadTypeScriptModule('src/lib/facebookPageTargetRouting.ts');
}

function loadPostTargetDisplayModule() {
  return loadTypeScriptModule('src/lib/postTargetDisplay.ts');
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function expectIncludes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message + `\nMissing snippet: ${needle}`);
}

function expectNotIncludes(haystack, needle, message) {
  assert.ok(!haystack.includes(needle), message + `\nUnexpected snippet: ${needle}`);
}

function normalizeTargets(targets) {
  return JSON.parse(
    JSON.stringify(
      targets.map((target) => ({
        accountId: target.accountId,
        pageId: target.pageId,
        pageName: target.pageName,
        platform: target.platform,
        targetType: target.targetType,
        sourceAccountName: target.sourceAccountName,
      }))
    )
  );
}

function run() {
  const helper = loadHelperModule();
  const postTargetDisplay = loadPostTargetDisplayModule();

  const pageA = {
    sourceAccountId: 101,
    sourceAccountName: 'Account One',
    sourceAccountDbId: 101,
    pageId: 'PAGE_A',
    pageName: 'ROUTING_TEST_PAGE_A',
    pictureUrl: null,
    category: 'Business',
    pageReadiness: 'ready',
    isSelected: true,
  };

  const pageB = {
    sourceAccountId: 101,
    sourceAccountName: 'Account One',
    sourceAccountDbId: 101,
    pageId: 'PAGE_B',
    pageName: 'ROUTING_TEST_PAGE_B',
    pictureUrl: null,
    category: 'Business',
    pageReadiness: 'ready',
    isSelected: true,
  };

  const pageC = {
    sourceAccountId: 202,
    sourceAccountName: 'Account Two',
    sourceAccountDbId: 202,
    pageId: 'PAGE_A',
    pageName: 'ROUTING_TEST_PAGE_ACCOUNT_2_A',
    pictureUrl: null,
    category: 'Brand',
    pageReadiness: 'ready',
    isSelected: true,
  };

  const pages = [pageA, pageB, pageC];

  assert.strictEqual(
    helper.getFacebookTargetKey(pageA),
    '101:PAGE_A',
    'target key must use accountId:pageId'
  );

  const aOnlySelection = helper.getSelectedFacebookPages(pages, [helper.getFacebookTargetKey(pageA)]);
  assert.deepStrictEqual(
    aOnlySelection.map((page) => page.pageId),
    ['PAGE_A'],
    'Page A only should select only Page A'
  );

  const aOnlyTargets = helper.buildExplicitFacebookPageTargets(aOnlySelection);
  assert.deepStrictEqual(
    normalizeTargets(aOnlyTargets),
    [
      {
        accountId: 101,
        pageId: 'PAGE_A',
        pageName: 'ROUTING_TEST_PAGE_A',
        platform: 'facebook',
        targetType: 'page',
        sourceAccountName: 'Account One',
      },
    ],
    'Page A only must produce one explicit page target with numeric accountId'
  );

  const bOnlySelection = helper.getSelectedFacebookPages(pages, [helper.getFacebookTargetKey(pageB)]);
  assert.deepStrictEqual(
    bOnlySelection.map((page) => page.pageId),
    ['PAGE_B'],
    'Page B only should select only Page B'
  );

  const bOnlyTargets = helper.buildExplicitFacebookPageTargets(bOnlySelection);
  assert.deepStrictEqual(
    normalizeTargets(bOnlyTargets),
    [
      {
        accountId: 101,
        pageId: 'PAGE_B',
        pageName: 'ROUTING_TEST_PAGE_B',
        platform: 'facebook',
        targetType: 'page',
        sourceAccountName: 'Account One',
      },
    ],
    'Page B only must produce one explicit page target with numeric accountId'
  );

  const sameAccountBoth = helper.getSelectedFacebookPages(pages, [
    helper.getFacebookTargetKey(pageA),
    helper.getFacebookTargetKey(pageB),
  ]);
  assert.deepStrictEqual(
    sameAccountBoth.map((page) => `${page.sourceAccountId}:${page.pageId}`),
    ['101:PAGE_A', '101:PAGE_B'],
    'Same-account multi-page selection must preserve both targets'
  );

  const sameAccountBothTargets = helper.buildExplicitFacebookPageTargets(sameAccountBoth);
  assert.deepStrictEqual(
    normalizeTargets(sameAccountBothTargets),
    [
      {
        accountId: 101,
        pageId: 'PAGE_A',
        pageName: 'ROUTING_TEST_PAGE_A',
        platform: 'facebook',
        targetType: 'page',
        sourceAccountName: 'Account One',
      },
      {
        accountId: 101,
        pageId: 'PAGE_B',
        pageName: 'ROUTING_TEST_PAGE_B',
        platform: 'facebook',
        targetType: 'page',
        sourceAccountName: 'Account One',
      },
    ],
    'A+B under one account must produce two distinct explicit targets'
  );
  assert.deepStrictEqual(
    Array.from(helper.getUniqueTargetAccountsFromPageTargets(sameAccountBothTargets)),
    [101],
    'A+B should produce one targetAccounts entry but two pageTargets'
  );

  const crossAccount = helper.getSelectedFacebookPages(pages, [
    helper.getFacebookTargetKey(pageA),
    helper.getFacebookTargetKey(pageC),
  ]);
  assert.deepStrictEqual(
    crossAccount.map((page) => `${page.sourceAccountId}:${page.pageId}`),
    ['101:PAGE_A', '202:PAGE_A'],
    'Cross-account page identities must remain distinct'
  );

  const crossAccountTargets = helper.buildExplicitFacebookPageTargets(crossAccount);
  assert.deepStrictEqual(
    normalizeTargets(crossAccountTargets),
    [
      {
        accountId: 101,
        pageId: 'PAGE_A',
        pageName: 'ROUTING_TEST_PAGE_A',
        platform: 'facebook',
        targetType: 'page',
        sourceAccountName: 'Account One',
      },
      {
        accountId: 202,
        pageId: 'PAGE_A',
        pageName: 'ROUTING_TEST_PAGE_ACCOUNT_2_A',
        platform: 'facebook',
        targetType: 'page',
        sourceAccountName: 'Account Two',
      },
    ],
    'Cross-account A+A must remain distinct by accountId + pageId'
  );
  assert.deepStrictEqual(
    Array.from(helper.getUniqueTargetAccountsFromPageTargets(crossAccountTargets)),
    [101, 202],
    'Cross-account A+A should preserve both numeric account IDs'
  );

  let selectedKeys = [];
  selectedKeys = helper.toggleFacebookTargetSelection(selectedKeys, pageA);
  selectedKeys = helper.toggleFacebookTargetSelection(selectedKeys, pageB);
  assert.deepStrictEqual(
    Array.from(selectedKeys),
    ['101:PAGE_A', '101:PAGE_B'],
    'Checking A then B should keep both selections'
  );

  selectedKeys = helper.toggleFacebookTargetSelection(selectedKeys, pageA);
  assert.deepStrictEqual(
    Array.from(selectedKeys),
    ['101:PAGE_B'],
    'Unchecking A should remove only A'
  );

  const dedupedKeys = helper.dedupeFacebookTargetKeys([
    '101:PAGE_A',
    '101:PAGE_A',
    '101:PAGE_B',
    '',
  ]);
  assert.deepStrictEqual(
    Array.from(dedupedKeys),
    ['101:PAGE_A', '101:PAGE_B'],
    'Duplicate target keys must be removed'
  );

  const dedupedPayloadTargets = helper.buildExplicitFacebookPageTargets([pageA, pageB, pageA]);
  assert.deepStrictEqual(
    normalizeTargets(dedupedPayloadTargets),
    [
      {
        accountId: 101,
        pageId: 'PAGE_A',
        pageName: 'ROUTING_TEST_PAGE_A',
        platform: 'facebook',
        targetType: 'page',
        sourceAccountName: 'Account One',
      },
      {
        accountId: 101,
        pageId: 'PAGE_B',
        pageName: 'ROUTING_TEST_PAGE_B',
        platform: 'facebook',
        targetType: 'page',
        sourceAccountName: 'Account One',
      },
    ],
    'Duplicate selected pages must not duplicate payload targets'
  );

  const editableTargets = helper.buildEditableFacebookPageTargets([
    {
      accountId: 101,
      platform: 'facebook',
      accountName: 'Account One',
      accountPlatformId: 'acc_one',
      targetType: 'page',
      pageId: 'PAGE_A',
      pageName: 'ROUTING_TEST_PAGE_A',
      sourceAccountName: 'Account One',
    },
    {
      accountId: 101,
      platform: 'facebook',
      accountName: 'Account One',
      accountPlatformId: 'acc_one',
      targetType: 'page',
      pageId: 'PAGE_B',
      pageName: 'ROUTING_TEST_PAGE_B',
      sourceAccountName: 'Account One',
    },
    {
      accountId: 101,
      platform: 'facebook',
      accountName: 'Account One',
      accountPlatformId: 'acc_one',
      targetType: 'page',
      pageId: 'PAGE_A',
      pageName: 'ROUTING_TEST_PAGE_A',
      sourceAccountName: 'Account One',
    },
    {
      accountId: 101,
      platform: 'facebook',
      accountName: 'Account One',
      accountPlatformId: 'acc_one',
      targetType: 'legacy_account',
      pageId: null,
      pageName: null,
      sourceAccountName: 'Account One',
    },
  ]);
  assert.deepStrictEqual(
    normalizeTargets(editableTargets),
    [
      {
        accountId: 101,
        pageId: 'PAGE_A',
        pageName: 'ROUTING_TEST_PAGE_A',
        platform: 'facebook',
        targetType: 'page',
        sourceAccountName: 'Account One',
      },
      {
        accountId: 101,
        pageId: 'PAGE_B',
        pageName: 'ROUTING_TEST_PAGE_B',
        platform: 'facebook',
        targetType: 'page',
        sourceAccountName: 'Account One',
      },
    ],
    'Editing and saving an A+B post must preserve both saved page targets and ignore legacy rows'
  );

  const reopenedSelectedKeys = helper.buildSelectedTargetKeysFromPostTargets([
    {
      accountId: 101,
      platform: 'facebook',
      accountName: 'Account One',
      accountPlatformId: 'acc_one',
      targetType: 'page',
      pageId: 'PAGE_A',
      pageName: 'ROUTING_TEST_PAGE_A',
      sourceAccountName: 'Account One',
    },
    {
      accountId: 101,
      platform: 'facebook',
      accountName: 'Account One',
      accountPlatformId: 'acc_one',
      targetType: 'page',
      pageId: 'PAGE_B',
      pageName: 'ROUTING_TEST_PAGE_B',
      sourceAccountName: 'Account One',
    },
  ]);
  assert.deepStrictEqual(
    Array.from(reopenedSelectedKeys),
    ['101:PAGE_A', '101:PAGE_B'],
    'Reopening saved edit state must still contain A+B selected target keys'
  );

  const allAccountIds = [
    ...aOnlyTargets,
    ...bOnlyTargets,
    ...sameAccountBothTargets,
    ...crossAccountTargets,
    ...editableTargets,
  ].map((target) => target.accountId);
  assert.ok(
    allAccountIds.every((accountId) => typeof accountId === 'number' && Number.isInteger(accountId)),
    'All emitted accountId values must be numbers'
  );

  const typeSource = readProjectFile('src/types/electron.d.ts');
  expectIncludes(
    typeSource,
    'accountId: number;',
    'Electron type definitions must require numeric accountId for explicit page targets'
  );

  const createPostPageSource = readProjectFile('src/pages/CreatePostPage.tsx');
  expectIncludes(
    createPostPageSource,
    "console.info(\n      '[CreatePostPage] selectedTargets=%o'",
    'CreatePostPage must log sanitized selectedTargets before IPC submission'
  );
  expectIncludes(
    createPostPageSource,
    'setSelectedTargetKeys((prev) => toggleFacebookTargetSelection(prev, page));',
    'CreatePostPage must use page-level selection toggling'
  );
  expectIncludes(
    createPostPageSource,
    'targetAccounts: getTargetAccounts(),',
    'CreatePostPage must emit targetAccounts derived from explicit page targets'
  );
  expectIncludes(
    createPostPageSource,
    'pageTargets,',
    'CreatePostPage must send every selected page in pageTargets'
  );

  const bulkCreatePageSource = readProjectFile('src/pages/BulkCreatePage.tsx');
  expectIncludes(
    bulkCreatePageSource,
    'targetAccounts: [page.sourceAccountId],',
    'BulkCreatePage must emit numeric targetAccounts from the selected page account'
  );
  expectIncludes(
    bulkCreatePageSource,
    'accountId: page.sourceAccountId,',
    'BulkCreatePage must emit numeric accountId for explicit page targets'
  );
  expectIncludes(
    bulkCreatePageSource,
    'pageId: page.pageId,',
    'BulkCreatePage must emit the selected pageId without collapsing to a default page'
  );

  const postsPageSource = readProjectFile('src/pages/PostsPage.tsx');
  expectIncludes(
    postsPageSource,
    'const pageTargets = buildEditableFacebookPageTargets(selectedPost.postTargets);',
    'PostsPage edit/save flow must preserve all saved page targets'
  );
  expectIncludes(
    postsPageSource,
    'getUniqueTargetAccountsFromPageTargets(pageTargets)',
    'PostsPage edit/save flow must derive target accounts from distinct page targets'
  );
  expectNotIncludes(
    postsPageSource,
    'const pageTargets: PostTargetPageSnapshot[] =\n        primaryTarget?.targetType === \'page\'',
    'PostsPage edit/save must not rebuild pageTargets from only the primary target'
  );

  const postServiceSource = readProjectFile('src/services/PostService.ts');
  expectIncludes(
    postServiceSource,
    'const key = `${target.accountId}:${target.pageId}`;',
    'PostService must dedupe explicit page targets by accountId + pageId'
  );
  expectIncludes(
    postServiceSource,
    "targetType: 'page'",
    'PostService must persist explicit page targets as page targets'
  );

  const publishJobServiceSource = readProjectFile('src/services/PublishJobService.ts');
  expectIncludes(
    publishJobServiceSource,
    "const targetKey = `${target.accountId}:${target.pageId ?? ''}`;",
    'PublishJobService must dedupe jobs by accountId + pageId'
  );
  expectIncludes(
    publishJobServiceSource,
    'pageId: target.pageId ?? null,',
    'PublishJobService must store pageId on each job'
  );

  const queueServiceSource = readProjectFile('src/services/QueueService.ts');
  expectIncludes(
    queueServiceSource,
    'pageId: job.pageId,',
    'QueueService must resolve readiness using the pageId stored on the job'
  );
  expectIncludes(
    queueServiceSource,
    'if (!job.pageId) {',
    'QueueService must fail missing explicit page IDs instead of falling back'
  );
  expectIncludes(
    queueServiceSource,
    'pageId: resolvedTarget.target.pageId,',
    'QueueService must publish using the exact resolved job page ID'
  );

  const readinessSource = readProjectFile('src/services/facebook/FacebookPublishReadinessService.ts');
  expectIncludes(
    readinessSource,
    'const page = pages.find((entry) => entry.id === pageId);',
    'FacebookPublishReadinessService must resolve the exact stored page within the account'
  );
  expectIncludes(
    readinessSource,
    "blockedReason: 'missing_page'",
    'FacebookPublishReadinessService must fail unknown explicit page IDs instead of defaulting'
  );

  const mainSource = readProjectFile('electron/main.ts');
  expectIncludes(
    mainSource,
    "typeof rawTarget?.accountId === 'number' ? rawTarget.accountId : Number.NaN",
    'Electron IPC must reject non-numeric accountId values instead of relying on string coercion'
  );
  expectIncludes(
    mainSource,
    "throw new Error('Invalid Facebook target: accountId is required.')",
    'Electron IPC must validate missing or invalid accountId'
  );
  expectIncludes(
    mainSource,
    "throw new Error('Invalid Facebook target: pageId is required.')",
    'Electron IPC must validate missing pageId'
  );

  const accountDefaultPage = {
    pageId: 'PAGE_A',
    pageName: 'Default Page A',
  };

  const persistedPostTarget = {
    accountId: 101,
    platform: 'facebook',
    accountName: 'Account One',
    accountPlatformId: 'acc_one',
    targetType: 'page',
    pageId: 'PAGE_B',
    pageName: 'Persisted Page B',
    sourceAccountName: 'Account One',
    platformPostId: 'PAGE_B_REMOTE_POST',
  };

  const serializedPersistedTarget = {
    accountId: persistedPostTarget.accountId,
    targetType: persistedPostTarget.targetType,
    pageId: persistedPostTarget.pageId,
    pageName: persistedPostTarget.pageName,
    sourceAccountName: persistedPostTarget.sourceAccountName,
    platformPostId: persistedPostTarget.platformPostId,
  };

  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(serializedPersistedTarget)),
    {
      accountId: 101,
      targetType: 'page',
      pageId: 'PAGE_B',
      pageName: 'Persisted Page B',
      sourceAccountName: 'Account One',
      platformPostId: 'PAGE_B_REMOTE_POST',
    },
    'Serializer contract must preserve persisted PAGE_B target fields exactly'
  );

  const persistedOnlyTargets = [persistedPostTarget];
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(postTargetDisplay.getPersistedPageTargets(persistedOnlyTargets))),
    [persistedPostTarget],
    'Persisted page target filtering must preserve PAGE_B exactly'
  );

  const persistedPageBLabel = postTargetDisplay.formatPersistedPageTargetLabel(persistedPostTarget);

  assert.strictEqual(
    persistedPageBLabel,
    'Persisted Page B · ••_B',
    'Persisted PAGE_B label must use the masked persisted pageId contract'
  );

  assert.strictEqual(
    postTargetDisplay.getPostTargetSummaryLabel(persistedOnlyTargets, 'en'),
    persistedPageBLabel,
    'List-card display must resolve to persisted Page B instead of the account default page'
  );

  assert.strictEqual(
    postTargetDisplay.formatPersistedPageTargetLabel(persistedPostTarget),
    persistedPageBLabel,
    'Detail display must resolve to persisted Page B instead of the account default page'
  );

  const changedAccountDefaultPage = {
    pageId: 'PAGE_C',
    pageName: 'Default Page C',
  };

  assert.notDeepStrictEqual(
    changedAccountDefaultPage,
    accountDefaultPage,
    'Fixture must model a changed account default page'
  );
  assert.strictEqual(
    postTargetDisplay.getPostTargetSummaryLabel(persistedOnlyTargets, 'en'),
    persistedPageBLabel,
    'Changing the account default page must not change the displayed persisted Page B target'
  );

  assert.strictEqual(
    postTargetDisplay.formatPersistedPageTargetLabel({
      pageId: 'PAGE_B',
      pageName: null,
    }),
    '••_B',
    'Missing pageName may fall back to the masked persisted pageId'
  );

  assert.strictEqual(
    postTargetDisplay.getPostTargetSummaryLabel(
      [
        persistedPostTarget,
        {
          accountId: 101,
          platform: 'facebook',
          accountName: 'Account One',
          accountPlatformId: 'acc_one',
          targetType: 'legacy_account',
          pageId: null,
          pageName: null,
          sourceAccountName: 'Account One',
        },
      ],
      'en'
    ),
    persistedPageBLabel,
    'Account name must not be used when a persisted page target exists'
  );

  assert.strictEqual(
    postTargetDisplay.getPostTargetSummaryLabel(
      [
        persistedPostTarget,
        {
          accountId: 101,
          platform: 'facebook',
          accountName: 'Account One',
          accountPlatformId: 'acc_one',
          targetType: 'page',
          pageId: 'PAGE_D',
          pageName: 'Persisted Page D',
          sourceAccountName: 'Account One',
          platformPostId: 'PAGE_D_REMOTE_POST',
        },
      ],
      'en'
    ),
    `2 Pages: ${persistedPageBLabel}, ${postTargetDisplay.formatPersistedPageTargetLabel({
      pageId: 'PAGE_D',
      pageName: 'Persisted Page D',
    })}`,
    'Multiple persisted page targets must display all persisted targets safely'
  );

  const stalePosts = [
    {
      id: 77,
      title: 'Stale post',
      content: 'content',
      mediaType: 'photo',
      mediaUrl: null,
      mediaLocalPath: null,
      mediaFileName: null,
      mediaFileSize: null,
      mediaMimeType: null,
      mediaExtension: null,
      mediaDurationMs: null,
      hashtags: null,
      status: 'published',
      scheduledAt: null,
      publishedAt: null,
      errorMessage: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      postTargets: [
        {
          ...persistedPostTarget,
          pageName: 'Stale Default Page A',
          pageId: 'PAGE_A',
        },
      ],
    },
  ];

  const refreshedPost = {
    ...stalePosts[0],
    updatedAt: '2026-01-02T00:00:00.000Z',
    postTargets: [persistedPostTarget],
  };

  const replacedPosts = postTargetDisplay.replacePostSnapshotInList(stalePosts, refreshedPost);
  assert.strictEqual(
    postTargetDisplay.getPostTargetSummaryLabel(replacedPosts[0].postTargets, 'en'),
    persistedPageBLabel,
    'A refreshed snapshot must replace an older stale label'
  );

  console.log('facebook-page-routing: PASS');
}

try {
  run();
} catch (error) {
  console.error('facebook-page-routing: FAIL');
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
}