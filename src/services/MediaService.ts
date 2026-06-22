import prisma from '@/lib/prisma';
import { MediaLibrary } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

class MediaService {
  private mediaDir: string;
  private thumbnailDir: string;

  constructor() {
    // Initialize media directories
    const userDataPath = app?.getPath('userData') || './data';
    this.mediaDir = path.join(userDataPath, 'media');
    this.thumbnailDir = path.join(userDataPath, 'thumbnails');
    this.initDirectories();
  }

  private async initDirectories() {
    try {
      await fs.mkdir(this.mediaDir, { recursive: true });
      await fs.mkdir(this.thumbnailDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create media directories:', error);
    }
  }

  async saveMedia(
    sourceFilePath: string,
    filename: string,
    mimeType: string
  ): Promise<MediaLibrary> {
    try {
      // Read source file
      const fileBuffer = await fs.readFile(sourceFilePath);
      const fileSize = fileBuffer.length;

      // Generate unique filename
      const timestamp = Date.now();
      const ext = path.extname(filename);
      const baseName = path.basename(filename, ext);
      const uniqueFilename = `${baseName}_${timestamp}${ext}`;

      // Save file to media directory
      const destPath = path.join(this.mediaDir, uniqueFilename);
      await fs.writeFile(destPath, fileBuffer);

      // Create media record
      const media = await prisma.mediaLibrary.create({
        data: {
          filename: uniqueFilename,
          filePath: destPath,
          fileSize,
          mimeType,
          thumbnailPath: null, // TODO: Generate thumbnail for images/videos
        },
      });

      return media;
    } catch (error) {
      console.error('Failed to save media:', error);
      throw new Error('Failed to save media file');
    }
  }

  async getMedia(id: number): Promise<MediaLibrary | null> {
    return prisma.mediaLibrary.findUnique({
      where: { id },
    });
  }

  async getAllMedia(page = 1, limit = 20) {
    const [media, total] = await Promise.all([
      prisma.mediaLibrary.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.mediaLibrary.count(),
    ]);

    return {
      media,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteMedia(id: number): Promise<void> {
    const media = await this.getMedia(id);
    if (!media) {
      throw new Error('Media not found');
    }

    try {
      // Delete files from disk
      await fs.unlink(media.filePath);
      if (media.thumbnailPath) {
        await fs.unlink(media.thumbnailPath);
      }

      // Delete from database
      await prisma.mediaLibrary.delete({
        where: { id },
      });
    } catch (error) {
      console.error('Failed to delete media:', error);
      throw new Error('Failed to delete media file');
    }
  }

  async getMediaStats() {
    const [totalCount, totalSize] = await Promise.all([
      prisma.mediaLibrary.count(),
      prisma.mediaLibrary.aggregate({
        _sum: {
          fileSize: true,
        },
      }),
    ]);

    return {
      totalFiles: totalCount,
      totalSize: totalSize._sum.fileSize || 0,
    };
  }
}

export default new MediaService();