// The starter podcast profiles that upstream open-notebook seeds via SurrealDB
// migration 7. Per-user databases created through the amplify path don't get
// the sample rows, so the Profiles tab offers to create them through the API.
// Upstream seeds these with legacy openai model fields; here the model refs
// are filled in at creation time from whatever models this deployment has
// registered, so generation actually works.

export interface DefaultSpeakerProfile {
    name: string;
    description: string;
    speakers: {
        name: string;
        voice_id: string;
        backstory: string;
        personality: string;
    }[];
}

export interface DefaultEpisodeProfile {
    name: string;
    description: string;
    speaker_config: string;
    default_briefing: string;
    num_segments: number;
}

export const DEFAULT_SPEAKER_PROFILES: DefaultSpeakerProfile[] = [
    {
        name: 'tech_experts',
        description: 'Two technical experts for tech discussions',
        speakers: [
            {
                name: 'Dr. Alex Chen',
                voice_id: 'nova',
                backstory:
                    'Senior AI researcher and former tech lead at major companies. Specializes in making complex technical concepts accessible.',
                personality:
                    'Analytical, clear communicator, asks probing questions to dig deeper into technical details',
            },
            {
                name: 'Jamie Rodriguez',
                voice_id: 'alloy',
                backstory:
                    'Full-stack engineer and tech entrepreneur. Loves practical applications and real-world implementations.',
                personality:
                    'Enthusiastic, practical-minded, great at explaining implementation details and trade-offs',
            },
        ],
    },
    {
        name: 'solo_expert',
        description: 'Single expert for educational content',
        speakers: [
            {
                name: 'Professor Sarah Kim',
                voice_id: 'nova',
                backstory:
                    'Distinguished professor and researcher. Has a gift for making complex topics accessible to broad audiences.',
                personality:
                    'Patient teacher, uses analogies and examples, breaks down complex concepts step by step',
            },
        ],
    },
    {
        name: 'business_panel',
        description: 'Business analysis panel with diverse perspectives',
        speakers: [
            {
                name: 'Marcus Thompson',
                voice_id: 'echo',
                backstory:
                    'Former McKinsey consultant, now startup advisor. Expert in strategic analysis and market dynamics.',
                personality:
                    'Strategic thinker, data-driven, excellent at identifying key insights and implications',
            },
            {
                name: 'Elena Vasquez',
                voice_id: 'shimmer',
                backstory:
                    'Serial entrepreneur and investor. Focuses on practical implementation and execution.',
                personality:
                    'Action-oriented, pragmatic, brings startup experience and execution focus',
            },
            {
                name: 'Johny Bing',
                voice_id: 'ash',
                backstory:
                    'Youtube celebrity and business mogul. Focuses on practical implementation and execution.',
                personality:
                    'Controversial, likes to question ideas and concepts. He brings a fresh perspective and always has a point to make.',
            },
        ],
    },
];

export const DEFAULT_EPISODE_PROFILES: DefaultEpisodeProfile[] = [
    {
        name: 'tech_discussion',
        description: 'Technical discussion between 2 experts',
        speaker_config: 'tech_experts',
        default_briefing:
            'Create an engaging technical discussion about the provided content. Focus on practical insights, real-world applications, and detailed explanations that would interest developers and technical professionals.',
        num_segments: 5,
    },
    {
        name: 'solo_expert',
        description: 'Single expert explaining complex topics',
        speaker_config: 'solo_expert',
        default_briefing:
            'Create an educational explanation of the provided content. Break down complex concepts into digestible segments, use analogies and examples, and maintain an engaging teaching style.',
        num_segments: 4,
    },
    {
        name: 'business_analysis',
        description: 'Business-focused analysis and discussion',
        speaker_config: 'business_panel',
        default_briefing:
            'Analyze the provided content from a business perspective. Discuss market implications, strategic insights, competitive advantages, and actionable business intelligence.',
        num_segments: 6,
    },
];
