import prisma from '@/lib/prisma';
import { Post, Prisma } from '@prisma/client';

export interface PostPageTargetData {
  platform: 'facebook';
  accountId: number;
  pageId: string;
  pageName: string;
  sourceAccountName?: string;
}

export interface CreatePostData {
  title?: string;
  content: string;
  postFormat?: 'post' | 'story';
  mediaType?: 'photo' | 'video' | 'none';
  mediaUrl?: string;
  mediaLocalPath?: string;
  mediaFileName?: string;
  mediaFileSize?: number;
  mediaMimeType?: string;
  mediaExtension?: string;
  mediaDurationMs?: number;
  hashtags?: string;
  status?: 'draft' | 'scheduled' | 'queued';
  scheduledAt?: Date;
  targetAccounts?: number[]; // legacy account IDs
  pageTargets?: PostPageTargetData[];
}

export interface UpdatePostData {
  title?: string;
  content?: string;
  postFormat?: 'post' | 'story';
  mediaType?: 'photo' | 'video' | 'none';
  mediaUrl?: string;
  mediaLocalPath?: string;
  mediaFileName?: string | null;
  mediaFileSize?: number | null;
  mediaMimeType?: string | null;
  mediaExtension?: string | null;
  mediaDurationMs?: number | null;
  hashtags?: string;
  status?: 'draft' | 'scheduled' | 'queued' | 'posting' | 'published' | 'partially_failed' | 'failed' | 'cancelled';
  scheduledAt?: Date;
  targetAccounts?: number[];
  pageTargets?: PostPageTargetData[];
}

export interface PostFilters {
  status?: string;
  platform?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

function normalizePostTargetCreates(input: {
  targetAccounts?: number[];
  pageTargets?: PostPageTargetData[];
}) {
  const explicitPageTargets = Array.isArray(input.pageTargets) ? input.pageTargets : [];
  if (explicitPageTargets.length > 0) {
    const uniquePageTargets = new Map<string, PostPageTargetData>();

    for (const target of explicitPageTargets) {
      const key = `${target.accountId}:${target.pageId}`;
      if (!uniquePageTargets.has(key)) {
        uniquePageTargets.set(key, target);
      }
    }

    return Array.from(uniquePageTargets.values()).map((target) => ({
      accountId: target.accountId,
      platform: target.platform,
      targetType: 'page',
      pageId: target.pageId,
      pageName: target.pageName,
      sourceAccountName: target.sourceAccountName ?? null,
      status: 'pending' as const,
    }));
  }

  const legacyAccounts = Array.isArray(input.targetAccounts) ? input.targetAccounts : [];
  return legacyAccounts.map((accountId) => ({
    accountId,
    platform: 'facebook',
    targetType: 'legacy_account',
    pageId: null,
    pageName: null,
    sourceAccountName: null,
    status: 'pending' as const,
  }));
}

class PostService {
  async createPost(data: CreatePostData): Promise<Post> {
    const { targetAccounts, pageTargets, ...postData } = data;
    const normalizedTargets = normalizePostTargetCreates({ targetAccounts, pageTargets });

    const post = await prisma.post.create({
      data: {
        ...postData,
        postTargets: {
          create: normalizedTargets,
        },
      },
      include: {
        postTargets: {
          include: {
            account: true,
          },
        },
      },
    });

    return post;
  }

  async updatePost(id: number, data: UpdatePostData): Promise<Post> {
    const { targetAccounts, pageTargets, ...postData } = data;
    const shouldUpdateTargets = typeof targetAccounts !== 'undefined' || typeof pageTargets !== 'undefined';

    if (shouldUpdateTargets) {
      const normalizedTargets = normalizePostTargetCreates({ targetAccounts, pageTargets });

      await prisma.postTarget.deleteMany({
        where: { postId: id },
      });

      if (normalizedTargets.length > 0) {
        await prisma.postTarget.createMany({
          data: normalizedTargets.map((target) => ({
            postId: id,
            ...target,
          })),
        });
      }
    }

    const post = await prisma.post.update({
      where: { id },
      data: postData,
      include: {
        postTargets: {
          include: {
            account: true,
          },
        },
      },
    });

    return post;
  }

  async deletePost(id: number): Promise<void> {
    await prisma.post.delete({
      where: { id },
    });
  }

  async getPost(id: number): Promise<Post | null> {
    return prisma.post.findUnique({
      where: { id },
      include: {
        postTargets: {
          include: {
            account: true,
          },
        },
      },
    });
  }

  async getPosts(filters?: PostFilters, page = 1, limit = 20) {
    const where: Prisma.PostWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { content: { contains: filters.search } },
        { hashtags: { contains: filters.search } },
      ];
    }

    if (filters?.startDate || filters?.endDate) {
      where.scheduledAt = {};
      if (filters.startDate) {
        where.scheduledAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.scheduledAt.lte = filters.endDate;
      }
    }

    if (filters?.platform) {
      where.postTargets = {
        some: {
          account: {
            platform: filters.platform,
          },
        },
      };
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          postTargets: {
            include: {
              account: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    return {
      posts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getScheduledPosts(): Promise<Post[]> {
    const now = new Date();
    return prisma.post.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: {
          lte: now,
        },
      },
      include: {
        postTargets: {
          include: {
            account: true,
          },
        },
      },
    });
  }

  async duplicatePost(id: number): Promise<Post> {
    const originalPost = await this.getPost(id);
    if (!originalPost) {
      throw new Error('Post not found');
    }

    // Extract only the post data fields we need
    const newPost = await prisma.post.create({
      data: {
        title: originalPost.title ? `${originalPost.title} (Copy)` : null,
        content: originalPost.content,
        mediaType: originalPost.mediaType,
        mediaUrl: originalPost.mediaUrl,
        mediaLocalPath: originalPost.mediaLocalPath,
        mediaFileName: (originalPost as any).mediaFileName ?? null,
        mediaFileSize: (originalPost as any).mediaFileSize ?? null,
        mediaMimeType: (originalPost as any).mediaMimeType ?? null,
        mediaExtension: (originalPost as any).mediaExtension ?? null,
        mediaDurationMs: (originalPost as any).mediaDurationMs ?? null,
        hashtags: originalPost.hashtags,
        status: 'draft',
        scheduledAt: null,
        publishedAt: null,
        errorMessage: null,
        postTargets: {
          create: (originalPost as any).postTargets.map((target: any) => ({
            accountId: target.accountId,
            platform: target.platform ?? 'facebook',
            targetType: target.targetType ?? (target.pageId ? 'page' : 'legacy_account'),
            pageId: target.pageId ?? null,
            pageName: target.pageName ?? null,
            sourceAccountName: target.sourceAccountName ?? null,
            status: 'pending',
          })),
        },
      } as any,
      include: {
        postTargets: {
          include: {
            account: true,
          },
        },
      },
    });

    return newPost;
  }

  async bulkDelete(ids: number[]): Promise<void> {
    await prisma.post.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  async getPostsByDateRange(startDate: Date, endDate: Date): Promise<Post[]> {
    return prisma.post.findMany({
      where: {
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        postTargets: {
          include: {
            account: true,
          },
        },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    });
  }

   async updatePostStatus(
     id: number,
     status: 'draft' | 'scheduled' | 'queued' | 'posting' | 'published' | 'partially_failed' | 'failed' | 'cancelled',
     errorMessage?: string
   ): Promise<Post> {
     return prisma.post.update({
       where: { id },
       data: {
         status,
         errorMessage,
         publishedAt: status === 'published' ? new Date() : undefined,
       },
     });
   }
}

export default new PostService();