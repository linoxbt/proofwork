// Mock task data for the frontend — used when no contract is connected

export interface MockTask {
  id: string;
  contractAddress: string;
  title: string;
  description: string;
  criteria: string;
  rewardAmount: number;
  creator: string;
  worker: string;
  status: 'open' | 'claimed' | 'submitted' | 'verified' | 'rejected';
  submissionUrl: string;
  verificationResult?: {
    verified: boolean;
    confidence: number;
    reasoning: string;
  };
}

export const MOCK_TASKS: MockTask[] = [
  {
    id: '1',
    contractAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    title: 'Build a REST API with authentication',
    description: 'Create a Node.js REST API with JWT authentication, user registration, and protected routes.',
    criteria: 'Must include: JWT token generation, password hashing with bcrypt, middleware for protected routes, at least 3 API endpoints, proper error handling.',
    rewardAmount: 500,
    creator: '0xAbC1...dEf2',
    worker: '',
    status: 'open',
    submissionUrl: '',
  },
  {
    id: '2',
    contractAddress: '0x9876543210fedcba9876543210fedcba98765432',
    title: 'Implement a React component library',
    description: 'Build a reusable React component library with Button, Input, Modal, and Toast components.',
    criteria: 'TypeScript support, Storybook documentation, unit tests with >80% coverage, proper accessibility (ARIA attributes).',
    rewardAmount: 750,
    creator: '0xFeDc...BaA9',
    worker: '0x1122...3344',
    status: 'claimed',
    submissionUrl: '',
  },
  {
    id: '3',
    contractAddress: '0xaabbccdd11223344aabbccdd11223344aabbccdd',
    title: 'Smart contract for token vesting',
    description: 'Write a Solidity smart contract that implements linear token vesting with cliff period.',
    criteria: 'Linear vesting schedule, configurable cliff period, revocable by admin, events for all state changes, comprehensive tests.',
    rewardAmount: 1000,
    creator: '0x5566...7788',
    worker: '0x9900...aabb',
    status: 'verified',
    submissionUrl: 'https://github.com/example/token-vesting',
    verificationResult: {
      verified: true,
      confidence: 92,
      reasoning: 'The repository contains a well-structured Solidity contract implementing linear vesting with a cliff period. All specified criteria are met: linear schedule via block.timestamp calculations, configurable cliff in constructor, admin revocation function with access control, proper events emitted, and a comprehensive test suite covering edge cases.',
    },
  },
  {
    id: '4',
    contractAddress: '0xdeadbeef12345678deadbeef12345678deadbeef',
    title: 'CLI tool for database migrations',
    description: 'Build a Python CLI tool that manages database schema migrations with up/down support.',
    criteria: 'Up and down migrations, version tracking table, rollback support, dry-run mode, colored terminal output.',
    rewardAmount: 600,
    creator: '0xCafe...Babe',
    worker: '0xDead...Beef',
    status: 'rejected',
    submissionUrl: 'https://github.com/example/db-migrator',
    verificationResult: {
      verified: false,
      confidence: 78,
      reasoning: 'The repository implements basic up migrations and version tracking, but is missing down migration support and dry-run mode. Rollback functionality is partially implemented but fails on edge cases. Only 3 of 5 criteria are met.',
    },
  },
];
