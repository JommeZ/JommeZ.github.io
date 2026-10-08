export interface Project {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  demoUrl?: string;
  repoUrl?: string;
  image?: string;
}

export const projects: Project[] = [
  {
    slug: 'multiplication-game',
    title: 'Multiplication Game',
    description: 'A timed arithmetic practice game for learning multiplication tables.',
    tags: ['game', 'javascript'],
    demoUrl: '/demos/multiplication-game/',
  },
  {
    slug: 'unicorn-raknespel',
    title: 'Enhörningens Räknespel',
    description: 'A Swedish-language unicorn-themed math practice game.',
    tags: ['game', 'javascript', 'svenska'],
    demoUrl: '/demos/unicorn-raknespel/',
  },
  {
    slug: 'melodifestivalen-quiz',
    title: 'Melodifestivalen Frågesport',
    description: 'A trivia quiz about Melodifestivalen, the Swedish song contest.',
    tags: ['quiz', 'javascript', 'svenska'],
    demoUrl: '/demos/melodifestivalen-quiz/',
  },
];
