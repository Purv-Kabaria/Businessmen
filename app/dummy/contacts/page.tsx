"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, Pause, User, Phone, Mail } from "lucide-react";

type InteractionWithAudio = {
  id: string;
  audioObjectKey: string | null;
  audioUrl: string | null;
  createdAt: string;
};

type ContactWithInteractions = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  company: string | null;
  interactions: InteractionWithAudio[];
};

export default function DummyContactsPage() {
  const [contacts, setContacts] = useState<ContactWithInteractions[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/dummy/contacts")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.data?.contacts) {
          setContacts(data.data.contacts);
        }
      })
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTimeUpdate = () => setProgress(el.currentTime);
    const onDurationChange = () => setDuration(el.duration || 0);
    const onEnded = () => {
      setPlayingId(null);
      setProgress(0);
    };
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("ended", onEnded);
    };
  }, [playingId]);

  function play(interaction: InteractionWithAudio) {
    if (!interaction.audioUrl) return;
    const el = audioRef.current;
    if (!el) return;
    if (playingId === interaction.id) {
      el.pause();
      setPlayingId(null);
      return;
    }
    el.src = interaction.audioUrl;
    el.play().catch(() => setPlayingId(null));
    setPlayingId(interaction.id);
    setProgress(0);
    setDuration(0);
  }

  function seek(percent: number) {
    const el = audioRef.current;
    if (!el || !duration) return;
    el.currentTime = (percent / 100) * duration;
    setProgress(el.currentTime);
  }

  function formatTime(s: number) {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-background">
      <audio ref={audioRef} preload="metadata" />
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Contacts with audio</h1>
        {contacts.length === 0 ? (
          <p className="text-muted-foreground">No contacts found.</p>
        ) : (
          <ul className="space-y-4">
            {contacts.map((contact) => (
              <li key={contact.id}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {contact.name ?? "Unnamed"}
                    </CardTitle>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {contact.phone}
                      </span>
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {contact.email}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {contact.interactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No audio.</p>
                    ) : (
                      contact.interactions.map((int) => (
                        <div
                          key={int.id}
                          className="rounded-lg border bg-muted/30 p-3 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 shrink-0"
                              onClick={() => play(int)}
                              disabled={!int.audioUrl}
                            >
                              {playingId === int.id ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              {new Date(int.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {int.audioUrl && (
                            <div className="space-y-1">
                              <div
                                role="progressbar"
                                aria-valuenow={
                                  playingId === int.id && duration > 0
                                    ? (progress / duration) * 100
                                    : 0
                                }
                                className="cursor-pointer"
                                onClick={(e) => {
                                  if (playingId !== int.id) return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const x = e.clientX - rect.left;
                                  const pct = (x / rect.width) * 100;
                                  seek(pct);
                                }}
                              >
                                <Progress
                                  value={
                                    playingId === int.id && duration > 0
                                      ? Math.min(
                                          100,
                                          (progress / duration) * 100
                                        )
                                      : 0
                                  }
                                  className="h-2 pointer-events-none"
                                />
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>
                                  {playingId === int.id
                                    ? formatTime(progress)
                                    : "0:00"}
                                </span>
                                <span>
                                  {playingId === int.id && duration > 0
                                    ? formatTime(duration)
                                    : "--:--"}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
