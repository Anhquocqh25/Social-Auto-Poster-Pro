import prisma from '@/lib/prisma';
import { Post, Prisma } from '@prisma/client';

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
  status?: 'draft' | 'scheduled';
  scheduledAt?: Date;
  targetAccounts: number[]; // account IDs
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
}

export interface PostFilters {
  status?: string;
  platform?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

class PostService {
  async createPost(data: CreatePostData): Promise<Post> {
    const { targetAccounts, ...postData } = data;

    const post = await prisma.post.create({
      data: {
        ...postData,
        postTargets: {
          create: targetAccounts.map((accountId) => ({
            accountId,
            status: 'pending',
          })),
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
    const { targetAccounts, ...postData } = data;

    // If targetAccounts is provided, update the post targets
    if (targetAccounts) {
      // Delete existing targets
      await prisma.postTarget.deleteMany({
        where: { postId: id },
      });

      // Create new targets
      await prisma.postTarget.createMany({
        data: targetAccounts.map((accountId) => ({
          postId: id,
          accountId,
          status: 'pending',
        })),
      });
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