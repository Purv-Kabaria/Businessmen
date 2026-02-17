export interface Contact {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    company: string | null;
    currentStage: string;
    intentTags: unknown;
}

export interface CreatedBy {
    id: string;
    fullName: string;
    email: string;
}

export interface AudioInteraction {
    id: string;
    audioUrls: (string | null)[];
    audioObjectKeys: string[];
    transcript: string | null;
    interactionIdByAudioIndex?: string[];
    allInteractionIds?: string[];
    structuredSnapshot: {
        /** Timestamp-based segments for sentence-level seek and highlighting. */
        segments?: Array<{ text: string; start: number; end: number }>;
        summary?: string;
        hotspots?: Array<{ start?: number; end?: number; label?: string; topic?: string; text?: string; [k: string]: unknown }>;
        sentiment?: {
            sentiment: string;
            score: number;
            distribution: Record<string, number>;
        };
        emotions?: Array<{ label: string; score: number }>;
        sentimentFlow?: number[];
        voiceEmotion?: {
            primary_emotion: string;
            score: number;
        };
        [key: string]: unknown;
    };
    tags: unknown;
    createdAt: string;
    contact: Contact;
    createdBy: CreatedBy;
}

export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export type TrackInfo = {
    id: string;
    url: string;
    title: string;
    subtitle: string;
    duration?: number
};
