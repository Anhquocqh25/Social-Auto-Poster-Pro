import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getElectronAPI } from '@/lib/electronApi';

const REDACTED_KEYS = new Set(['access_token', 'code', 'client_secret', 'app_secret']);

function redactSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValues(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        REDACTED_KEYS.has(key) ? '[REDACTED]' : redactSensitiveValues(nestedValue),
      ])
    );
  }

  return value;
}

function toSafeErrorString(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(redactSensitiveValues(error), null, 2);
    } catch {
      return 'Unknown OAuth callback error.';
    }
  }

  return 'Unknown OAuth callback error.';
}

export function OAuthCallbackPage() {
  const electronAPI = getElectronAPI();
  const callbackUrl = useMemo(() => window.location.href, []);
  const hasElectronAccountsApi =
    typeof window !== 'undefined' && !!window.electronAPI?.accounts;
  const [copied, setCopied] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const { status, message } = useMemo(() => {
    try {
      const currentUrl = new URL(callbackUrl);
      const error = currentUrl.searchParams.get('error');
      const errorDescription = currentUrl.searchParams.get('error_description');
      const hasCode = !!currentUrl.searchParams.get('code');
      const hasState = !!currentUrl.searchParams.get('state');

      if (error) {
        return {
          status: 'error' as const,
          message: errorDescription || error,
        };
      }

      if (hasCode && hasState) {
        return {
          status: 'success' as const,
          message: 'Authorization callback received. Copy this full URL and paste it into Social Auto Poster Pro to finish connecting Facebook.',
        };
      }

      return {
        status: 'info' as const,
        message: 'Paste this callback URL into Social Auto Poster Pro to complete authorization.',
      };
    } catch (error) {
      return {
        status: 'error' as const,
        message: toSafeErrorString(error),
      };
    }
  }, [callbackUrl]);

  useEffect(() => {
    document.title = 'Facebook Callback';
  }, []);

  const handleCopyCallbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleCloseWindow = async () => {
    if (!hasElectronAccountsApi) {
      window.close();
      return;
    }

    try {
      setIsClosing(true);
      await electronAPI.oauth.closeWindow();
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader>
          <CardTitle>Facebook Connection</CardTitle>
          <CardDescription>
            {status === 'success'
              ? 'Facebook authorization callback received.'
              : status === 'error'
                ? 'Facebook authorization could not be completed.'
                : 'Browser-safe callback helper.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-3 text-sm">
            <p>{message}</p>
          </div>

          {!hasElectronAccountsApi ? (
            <p className="text-sm text-muted-foreground">
              Paste this callback URL into Social Auto Poster Pro to complete authorization.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              This window never completes OAuth automatically. Copy the full callback URL and paste it into the Connect Facebook modal in the main app window.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleCopyCallbackUrl}>
              {copied ? 'Copied Callback URL' : 'Copy Callback URL'}
            </Button>
            <Button type="button" onClick={handleCloseWindow} disabled={isClosing}>
              Close Window
            </Button>
          </div>

          {!hasElectronAccountsApi ? (
            <p className="text-sm text-muted-foreground">
              You can close this tab and return to Social Auto Poster Pro.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}