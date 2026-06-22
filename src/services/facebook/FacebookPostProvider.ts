import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/crypto';
import { OAuthError } from '@/types/oauth';
import {
  FacebookPublishRequest,
  FacebookPublishResult,
  IFacebookPostProvider,
} from './FacebookProviderTypes';

export class FacebookPostProvider implements IFacebookPostProvider {
  private readonly graphBase = 'https://graph.facebook.com/v18.0';
  private readonly requestTimeoutMs = 30000;

  private getSimulationDirective(message?: string): 'success' | 'retry_once' | 'always_fail' {
    const normalized = (message ?? '').toLowerCase();

    if (normalized.includes('[simulate:always_fail]')) {
      return 'always_fail';
    }

    if (normalized.includes('[simulate:retry_once]')) {
      return 'retry_once';
    }

    return 'success';
  }

  private buildSimulationResult(
    type: 'text' | 'image' | 'video',
    request: FacebookPublishRequest
  ): FacebookPublishResult {
    const directive = this.getSimulationDirective(request.message);

    if (directive === 'always_fail') {
      return {
        success: false,
        errorCode: 'SIMULATION_FORCED_FAILURE',
        errorMessage: 'Simulation mode forced a permanent publish failure.',
        rawResponse: {
          simulation: true,
          directive,
          mediaType: type,
        },
        mode: 'simulation',
        finalState: 'failed',
      };
    }

    if (
      directive === 'retry_once' &&
      !request.message?.toLowerCase().includes('[simulated-retry-complete]')
    ) {
      return {
        success: false,
        errorCode: 'SIMULATION_RETRYABLE_FAILURE',
        errorMessage: 'Simulation mode forced a retryable publish failure.',
        rawResponse: {
          simulation: true,
          directive,
          mediaType: type,
        },
        mode: 'simulation',
        finalState: 'failed',
      };
    }

    const id = `fb_sim_${type}_${Date.now()}`;
    return {
      success: true,
      postId: id,
      rawResponse: {
        id,
        simulation: true,
        directive,
        mediaType: type,
      },
      mode: 'simulation',
      finalState: 'published',
    };
  }

  async publishText(request: FacebookPublishRequest): Promise<FacebookPublishResult> {
    if (request.publishMode === 'simulation') {
      return this.buildSimulationResult('text', request);
    }

    try {
      const response = await axios.post(
        `${this.graphBase}/${request.pageId}/feed`,
        null,
        {
          params: {
            access_token: request.pageAccessToken,
            message: request.message ?? '',
          },
          timeout: this.requestTimeoutMs,
        }
      );

      const postId = response.data?.id;
      if (!postId) {
        return {
          success: false,
          errorCode: 'FACEBOOK_GRAPH_MISSING_POST_ID',
          errorMessage: 'Facebook Graph response did not include a post id.',
          rawResponse: sanitizeForLog(response.data) as Record<string, unknown>,
          mode: 'real',
          finalState: 'failed',
        };
      }

      return {
        success: true,
        postId,
        rawResponse: response.data,
        mode: 'real',
        finalState: 'published',
      };
    } catch (error) {
      logger.error('[FacebookPostProvider] Text publish failed', {
        error: sanitizeForLog(error),
      });
      return this.mapPublishError(error, 'real');
    }
  }

  async publishImage(request: FacebookPublishRequest): Promise<FacebookPublishResult> {
    if (request.publishMode === 'simulation') {
      return this.buildSimulationResult('image', request);
    }

    if (!request.mediaLocalPath) {
        return {
          success: false,
          errorCode: 'FACEBOOK_LOCAL_IMAGE_MISSING',
          errorMessage: 'Local image file is missing. Reattach the image or save as draft.',
          mode: 'real',
          finalState: 'failed',
        };
    }

    const extension = path.extname(request.mediaLocalPath).toLowerCase();
    const mimeType =
      extension === '.jpg' || extension === '.jpeg'
        ? 'image/jpeg'
        : extension === '.png'
          ? 'image/png'
          : extension === '.webp'
            ? 'image/webp'
            : null;

    if (!mimeType) {
      return {
        success: false,
        errorCode: 'FACEBOOK_UNSUPPORTED_IMAGE_TYPE',
        errorMessage: 'Unsupported media type for Facebook image publish.',
        mode: 'real',
        finalState: 'failed',
      };
    }

    const localFileExists = fs.existsSync(request.mediaLocalPath);
    console.info(
      `[FacebookImagePublish] local file exists=${localFileExists ? 'true' : 'false'} mime=${mimeType ?? 'unknown'}`
    );

    if (!localFileExists) {
      return {
        success: false,
        errorCode: 'FACEBOOK_LOCAL_IMAGE_MISSING',
        errorMessage: 'Local image file is missing. Reattach the image or save as draft.',
        mode: 'real',
        finalState: 'failed',
      };
    }

    try {
      console.info(
        `[FacebookImagePublish] Graph /photos upload start pageIdMasked=${request.pageId ? `${String(request.pageId).slice(0, 2)}••••${String(request.pageId).slice(-4)}` : 'unknown'}`
      );

      const form = new FormData();
      form.append('access_token', request.pageAccessToken);
      form.append('caption', request.message ?? '');
      form.append('source', fs.createReadStream(request.mediaLocalPath), {
        contentType: mimeType,
        filename: path.basename(request.mediaLocalPath),
      });

      const response = await axios.post(
        `${this.graphBase}/${request.pageId}/photos`,
        form,
        {
          headers: form.getHeaders(),
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: this.requestTimeoutMs,
        }
      );

      const postId = response.data?.post_id || response.data?.id;
      if (!postId || String(postId).startsWith('fb_sim_')) {
        return {
          success: false,
          errorCode: 'FACEBOOK_GRAPH_MISSING_POST_ID',
          errorMessage: 'Facebook Graph response did not include a confirmed real post id.',
          rawResponse: sanitizeForLog(response.data) as Record<string, unknown>,
          mode: 'real',
          finalState: 'failed',
        };
      }

      console.info(
        `[FacebookImagePublish] Graph success idSuffix=${String(postId).slice(-6)}`
      );

      return {
        success: true,
        postId: String(postId),
        rawResponse: response.data,
        mode: 'real',
        finalState: 'published',
      };
    } catch (error) {
      logger.error('[FacebookPostProvider] Image publish failed', {
        error: sanitizeForLog(error),
      });
      return this.mapPublishError(error, 'real');
    }
  }

  async publishVideo(request: FacebookPublishRequest): Promise<FacebookPublishResult> {
    if (request.publishMode === 'simulation') {
      return this.buildSimulationResult('video', request);
    }

    if (!request.mediaLocalPath) {
      return {
        success: false,
        errorCode: 'FACEBOOK_LOCAL_VIDEO_MISSING',
        errorMessage: 'Local video file is missing. Reattach the video or save as draft.',
        mode: 'real',
        finalState: 'failed',
      };
    }

    const extension = path.extname(request.mediaLocalPath).toLowerCase();
    const mimeType =
      extension === '.mp4' || extension === '.m4v'
        ? 'video/mp4'
        : extension === '.mov'
          ? 'video/quicktime'
          : extension === '.avi'
            ? 'video/x-msvideo'
            : extension === '.webm'
              ? 'video/webm'
              : null;

    if (!mimeType) {
      return {
        success: false,
        errorCode: 'FACEBOOK_UNSUPPORTED_VIDEO_TYPE',
        errorMessage: 'Unsupported media type for Facebook video upload.',
        mode: 'real',
        finalState: 'failed',
      };
    }

    const localFileExists = fs.existsSync(request.mediaLocalPath);
    console.info(
      `[FacebookVideoPublish] local file exists=${localFileExists ? 'true' : 'false'} mime=${mimeType ?? 'unknown'}`
    );

    if (!localFileExists) {
      return {
        success: false,
        errorCode: 'FACEBOOK_LOCAL_VIDEO_MISSING',
        errorMessage: 'Local video file is missing. Reattach the video or save as draft.',
        mode: 'real',
        finalState: 'failed',
      };
    }

    try {
      console.info(
        `[FacebookVideoPublish] Graph /videos upload start pageIdMasked=${request.pageId ? `${String(request.pageId).slice(0, 2)}••••${String(request.pageId).slice(-4)}` : 'unknown'}`
      );

      const form = new FormData();
      form.append('access_token', request.pageAccessToken);
      form.append('description', request.message ?? '');
      form.append('source', fs.createReadStream(request.mediaLocalPath), {
        contentType: mimeType,
        filename: path.basename(request.mediaLocalPath),
      });

      const response = await axios.post(
        `${this.graphBase}/${request.pageId}/videos`,
        form,
        {
          headers: form.getHeaders(),
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: this.requestTimeoutMs,
        }
      );

      const responseId = response.data?.id;
      const safeRawResponse = sanitizeForLog(response.data) as Record<string, unknown>;
      const isLikelyVideoId =
        typeof responseId === 'string' &&
        responseId.length > 0 &&
        !responseId.startsWith('fb_sim_');

      if (!isLikelyVideoId) {
        return {
          success: false,
          errorCode: 'FACEBOOK_GRAPH_MISSING_VIDEO_ID',
          errorMessage: 'Facebook Graph response did not include a confirmed video id.',
          rawResponse: {
            provider: 'facebook',
            endpointCategory: 'video_upload',
            httpStatus: 200,
            errorType: null,
            safeErrorMessage: 'Facebook Graph response did not include a confirmed video id.',
            retryable: false,
            timestamp: new Date().toISOString(),
            graphErrorCode: null,
            response: safeRawResponse,
          },
          mode: 'real',
          finalState: 'failed',
        };
      }

      const publishStatus =
        typeof response.data?.success === 'boolean'
          ? response.data.success
          : typeof response.data?.published === 'boolean'
            ? response.data.published
            : null;

      if (publishStatus === false) {
        return {
          success: false,
          errorCode: 'FACEBOOK_VIDEO_UPLOAD_NOT_CONFIRMED',
          errorMessage: 'Facebook video upload was accepted but publish confirmation was not returned.',
          rawResponse: {
            provider: 'facebook',
            endpointCategory: 'video_upload',
            httpStatus: 200,
            errorType: null,
            safeErrorMessage: 'Facebook video upload was accepted but publish confirmation was not returned.',
            retryable: false,
            timestamp: new Date().toISOString(),
            graphErrorCode: null,
            response: safeRawResponse,
          },
          mode: 'real',
          finalState: 'needs_verification',
        };
      }

      console.info(
        `[FacebookVideoPublish] Graph accepted idSuffix=${String(responseId).slice(-6)}`
      );

      return {
        success: true,
        postId: String(responseId),
        rawResponse: response.data,
        mode: 'real',
        finalState: publishStatus === true ? 'published' : 'needs_verification',
      };
    } catch (error) {
      logger.error('[FacebookPostProvider] Video publish failed', {
        error: sanitizeForLog(error),
      });
      return this.mapPublishError(error, 'real');
    }
  }

  private mapPublishError(error: unknown, mode: 'simulation' | 'real'): FacebookPublishResult {
    if (axios.isAxiosError(error)) {
      const graphError = error.response?.data?.error;
      const responseData = error.response?.data;
      const requestUrl = typeof error.config?.url === 'string' ? error.config.url.toLowerCase() : '';
      const endpointCategory = requestUrl.includes('/photos')
        ? 'photo_upload'
        : requestUrl.includes('/feed')
          ? 'feed_publish'
          : requestUrl.includes('/videos')
            ? 'video_upload'
            : 'unknown';
      const isTimeout =
        error.code === 'ECONNABORTED' ||
        error.message.toLowerCase().includes('timeout');
      const safeErrorMessage = isTimeout
        ? 'Facebook Graph publish request timed out before a confirmed result was received.'
        : graphError?.message || error.message;
      const httpStatus =
        typeof error.response?.status === 'number' ? error.response.status : null;
      const errorType =
        typeof graphError?.type === 'string' ? graphError.type : null;
      const retryable = isTimeout
        ? true
        : typeof httpStatus === 'number'
          ? httpStatus >= 500 || httpStatus === 429
          : null;

      return {
        success: false,
        errorCode: isTimeout
          ? 'FACEBOOK_GRAPH_TIMEOUT'
          : graphError?.code?.toString?.() || 'FACEBOOK_GRAPH_ERROR',
        errorMessage: safeErrorMessage,
        rawResponse: {
          provider: 'facebook',
          endpointCategory,
          httpStatus,
          errorType,
          safeErrorMessage,
          retryable,
          timestamp: new Date().toISOString(),
          graphErrorCode:
            graphError?.code !== undefined && graphError?.code !== null
              ? String(graphError.code)
              : null,
          response:
            responseData ? (sanitizeForLog(responseData) as Record<string, unknown>) : undefined,
        },
        mode,
        finalState: 'failed',
      };
    }

    if (error instanceof OAuthError) {
      return {
        success: false,
        errorCode: error.code,
        errorMessage: error.message,
        mode,
        finalState: 'failed',
      };
    }

    return {
      success: false,
      errorCode: 'FACEBOOK_PUBLISH_UNKNOWN',
      errorMessage: error instanceof Error ? error.message : 'Unknown Facebook publish error',
      mode,
      finalState: 'failed',
    };
  }
}