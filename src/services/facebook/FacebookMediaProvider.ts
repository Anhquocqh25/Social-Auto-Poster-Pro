import fs from 'fs';
import path from 'path';
import { IFacebookMediaProvider } from './FacebookProviderTypes';

export class FacebookMediaProvider implements IFacebookMediaProvider {
  private readonly supportedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  private readonly supportedVideoExtensions = new Set(['.mp4', '.mov', '.m4v', '.avi', '.webm']);

  async validateMedia(input: {
    mediaType?: 'photo' | 'video' | 'none';
    mediaUrl?: string;
    mediaLocalPath?: string;
  }): Promise<{
    ok: boolean;
    error?: string;
  }> {
    const mediaType = input.mediaType ?? 'none';

    if (mediaType === 'none') {
      return { ok: true };
    }

    if (!input.mediaUrl && !input.mediaLocalPath) {
      return {
        ok: false,
        error: 'Media type selected but no media source was provided',
      };
    }

    if (input.mediaLocalPath) {
      const exists = fs.existsSync(input.mediaLocalPath);
      if (!exists) {
        return {
          ok: false,
          error: 'Local image file is missing. Reattach the image or save as draft.',
        };
      }

      const extension = path.extname(input.mediaLocalPath).toLowerCase();

      if (mediaType === 'photo' && !this.supportedImageExtensions.has(extension)) {
        return {
          ok: false,
          error: 'Unsupported media type for Facebook image publish.',
        };
      }

      if (mediaType === 'video' && !this.supportedVideoExtensions.has(extension)) {
        return {
          ok: false,
          error: 'Unsupported media type for Facebook image publish.',
        };
      }
    }

    if (input.mediaUrl) {
      try {
        const url = new URL(input.mediaUrl);
        const extension = path.extname(url.pathname).toLowerCase();

        if (mediaType === 'photo' && extension && !this.supportedImageExtensions.has(extension)) {
          return {
            ok: false,
            error: 'Unsupported media type for Facebook image publish.',
          };
        }

        if (mediaType === 'video' && extension && !this.supportedVideoExtensions.has(extension)) {
          return {
            ok: false,
            error: 'Unsupported media type for Facebook image publish.',
          };
        }
      } catch {
        return {
          ok: false,
          error: 'Invalid media URL',
        };
      }
    }

    return { ok: true };
  }
}