import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import type { PostSnapshot } from '@/types/electron';
import { getElectronAPI } from '@/lib/electronApi';

export function CalendarPage() {
  const electronAPI = getElectronAPI();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [posts, setPosts] = useState<PostSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const monthStart = useMemo(() => new Date(year, month, 1), [year, month]);
  const monthEnd = useMemo(() => new Date(year, month + 1, 0, 23, 59, 59, 999), [year, month]);

  const loadPosts = async () => {
    try {
      setStatusMessage(null);
      const scheduledPosts = await electronAPI.posts.getByDateRange({
        startDate: monthStart.toISOString(),
        endDate: monthEnd.toISOString(),
      });
      setPosts(scheduledPosts.filter((post) => !!post.scheduledAt));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to load scheduled posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void loadPosts();
  }, [monthStart, monthEnd]);

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getPostsForDate = (date: number) => {
    return posts.filter((post) => {
      if (!post.scheduledAt) return false;
      const scheduled = new Date(post.scheduledAt);
      return (
        scheduled.getDate() === date &&
        scheduled.getMonth() === month &&
        scheduled.getFullYear() === year
      );
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Calendar</h2>
        <p className="text-muted-foreground">
          View your scheduled posts in calendar format
        </p>
      </div>

      {statusMessage && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">{statusMessage}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">
              {monthNames[month]} {year}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={previousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading scheduled posts…</div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="p-2 text-center text-sm font-semibold text-muted-foreground"
                >
                  {day}
                </div>
              ))}

              {Array.from({ length: startingDayOfWeek }).map((_, index) => (
                <div key={`empty-${index}`} className="p-2" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, index) => {
                const date = index + 1;
                const postsForDate = getPostsForDate(date);
                const isToday =
                  date === new Date().getDate() &&
                  month === new Date().getMonth() &&
                  year === new Date().getFullYear();

                return (
                  <div
                    key={date}
                    className={`min-h-[100px] rounded-lg border p-2 transition-colors ${
                      isToday ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                    }`}
                  >
                    <div className={`mb-1 text-sm font-semibold ${isToday ? 'text-primary' : ''}`}>
                      {date}
                    </div>
                    <div className="space-y-1">
                      {postsForDate.map((post) => (
                        <div
                          key={post.id}
                          className="truncate rounded bg-blue-500/10 p-1 text-xs text-blue-700 dark:text-blue-300"
                          title={`${post.title ?? 'Untitled'} at ${post.scheduledAt ? new Date(post.scheduledAt).toLocaleTimeString() : ''}`}
                        >
                          {post.scheduledAt
                            ? new Date(post.scheduledAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '--:--'}{' '}
                          {post.title ?? 'Untitled'}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled posts found.</p>
            ) : (
              [...posts]
                .sort((a, b) => {
                  const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
                  const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
                  return aTime - bTime;
                })
                .map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{post.title ?? 'Untitled Post'}</p>
                        <p className="text-sm text-muted-foreground">
                          {post.scheduledAt
                            ? `${new Date(post.scheduledAt).toLocaleDateString()} at ${new Date(
                                post.scheduledAt
                              ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : 'No schedule'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{post.status}</Badge>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}